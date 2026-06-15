import { supabaseAdmin } from '@/lib/supabase'

export interface AuditEvent {
  actor?: string | null
  action: string
  targetType?: string
  targetId?: string
  detail?: Record<string, unknown>
}

/** 監査ログ書き込み。失敗してもアプリは続行する（best-effort）。 */
export async function audit(ev: AuditEvent): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor: ev.actor ?? null,
      action: ev.action,
      target_type: ev.targetType ?? null,
      target_id: ev.targetId ?? null,
      detail: ev.detail ?? null,
    })
  } catch (e) {
    console.error('[audit] insert failed', e)
  }
}
