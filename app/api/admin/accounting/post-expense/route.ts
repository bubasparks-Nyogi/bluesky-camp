import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildExpenseEntry, buildExpenseEntryFromLines } from '@/lib/accounting/ocrReceipt'
import { validateEntry } from '@/lib/accounting/validateEntry'
import { normalizeTaxRate, taxFromIncluded } from '@/lib/tax'

interface PurchaseLineBody {
  itemId?: string | null
  itemName: string
  quantity: number
  unitPrice?: number | null
  subtotal: number
  accountCode: string
  taxRate?: number
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    date?: string; amount?: number; description?: string
    debitAccountId?: string; creditAccountId?: string; receiptPath?: string
    items?: PurchaseLineBody[]
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { date, description, creditAccountId, receiptPath, items } = body
  if (!date || !creditAccountId)
    return NextResponse.json({ error: '日付・支払元が必要です' }, { status: 400 })

  const useLines = Array.isArray(items) && items.length > 0

  // 明細ルート: items[] を検証・費用科目に集約
  if (useLines) {
    for (let i = 0; i < items!.length; i++) {
      const it = items![i]
      if (!it.itemName?.trim())         return NextResponse.json({ error: `${i+1}行目: 商品名が必要です` }, { status: 400 })
      if (!(it.quantity > 0))           return NextResponse.json({ error: `${i+1}行目: 数量は正の値が必要です` }, { status: 400 })
      if (!Number.isInteger(it.subtotal) || it.subtotal <= 0)
        return NextResponse.json({ error: `${i+1}行目: 小計は正の整数が必要です` }, { status: 400 })
      if (!it.accountCode)              return NextResponse.json({ error: `${i+1}行目: 費用科目が未選択です` }, { status: 400 })
    }

    // account_code → account_id 解決
    const codes = Array.from(new Set(items!.map(it => it.accountCode)))
    const { data: expAccs } = await supabaseAdmin
      .from('accounts').select('id, code').in('code', codes).eq('is_active', true)
    const codeToId = new Map<string, string>((expAccs ?? []).map(a => [a.code as string, a.id as string]))
    for (const c of codes) if (!codeToId.has(c))
      return NextResponse.json({ error: `費用科目コード ${c} が見つかりません` }, { status: 400 })

    // 貸方の存在確認
    const { data: credAcc } = await supabaseAdmin.from('accounts').select('id').eq('id', creditAccountId).maybeSingle()
    if (!credAcc) return NextResponse.json({ error: '支払元科目が見つかりません' }, { status: 400 })

    // 借方を account_id ごとに集約
    const debitMap = new Map<string, number>()
    for (const it of items!) {
      const id = codeToId.get(it.accountCode)!
      debitMap.set(id, (debitMap.get(id) ?? 0) + it.subtotal)
    }
    const debits = Array.from(debitMap.entries()).map(([accountId, amount]) => ({ accountId, amount }))

    let entry
    try {
      entry = buildExpenseEntryFromLines({ date, description: description ?? '', debits, creditAccountId })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : '仕訳の組み立てに失敗しました' }, { status: 400 })
    }
    const err = validateEntry(entry)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    // ヘッダー作成
    const { data: header, error: headerErr } = await supabaseAdmin
      .from('journal_entries')
      .insert({ entry_date: entry.entryDate, description: entry.description, source: 'expense', receipt_url: receiptPath ?? null })
      .select().single()
    if (headerErr || !header) return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

    // 仕訳明細
    const lines = entry.lines.map((l, i) => ({
      journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
    }))
    const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
    if (linesErr) {
      await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
      return NextResponse.json({ error: linesErr.message }, { status: 500 })
    }

    // purchase_lines 挿入（税額はサーバ側で確定計算）
    const plRows = items!.map(it => {
      const taxRate = normalizeTaxRate(it.taxRate)
      return {
        journal_entry_id: header.id,
        item_id: it.itemId || null,
        item_name: it.itemName.trim(),
        quantity: it.quantity,
        unit_price: it.unitPrice ?? null,
        subtotal: it.subtotal,
        account_code: it.accountCode,
        tax_rate: taxRate,
        tax_amount: taxFromIncluded(it.subtotal, taxRate),
        occurred_at: date,
      }
    })
    const { data: plInserted, error: plErr } = await supabaseAdmin
      .from('purchase_lines').insert(plRows).select('id, item_id, quantity, occurred_at')
    if (plErr) {
      await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
      return NextResponse.json({ error: `明細保存失敗: ${plErr.message}` }, { status: 500 })
    }

    // 商品マスタ紐付け行は在庫加算（track_inventory=true のみ）
    const linkedItemIds = Array.from(new Set((plInserted ?? []).map(p => p.item_id).filter(Boolean))) as string[]
    if (linkedItemIds.length > 0) {
      const { data: itemMasters } = await supabaseAdmin
        .from('items').select('id, current_quantity, track_inventory').in('id', linkedItemIds)
      const stockMap = new Map<string, { qty: number; track: boolean }>()
      for (const im of itemMasters ?? [])
        stockMap.set(im.id as string, { qty: Number(im.current_quantity ?? 0), track: Boolean(im.track_inventory) })

      for (const p of plInserted ?? []) {
        if (!p.item_id) continue
        const master = stockMap.get(p.item_id as string)
        if (!master || !master.track) continue
        const qty = Number(p.quantity)
        await supabaseAdmin.from('stock_movements').insert({
          item_id: p.item_id, type: 'purchase', quantity_delta: qty,
          note: `purchase_line:${p.id}`, occurred_at: p.occurred_at,
        })
        const next = master.qty + qty
        await supabaseAdmin.from('items').update({ current_quantity: next }).eq('id', p.item_id)
        stockMap.set(p.item_id as string, { qty: next, track: master.track })
      }
    }

    return NextResponse.json({ entryId: header.id, itemCount: plRows.length, stockUpdated: linkedItemIds.length })
  }

  // 旧経路: 単一費用科目
  const { amount, debitAccountId } = body
  if (!debitAccountId || typeof amount !== 'number')
    return NextResponse.json({ error: '金額・費用科目が必要です' }, { status: 400 })

  const { data: accs } = await supabaseAdmin.from('accounts').select('id').in('id', [debitAccountId, creditAccountId])
  if (!accs || accs.length < 2)
    return NextResponse.json({ error: '指定された科目が見つかりません' }, { status: 400 })

  let entry
  try {
    entry = buildExpenseEntry({ date, amount, description: description ?? '', debitAccountId, creditAccountId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '仕訳の組み立てに失敗しました' }, { status: 400 })
  }
  const err = validateEntry(entry)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: entry.entryDate, description: entry.description, source: 'expense', receipt_url: receiptPath ?? null })
    .select().single()
  if (headerErr || !header) return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ entryId: header.id })
}
