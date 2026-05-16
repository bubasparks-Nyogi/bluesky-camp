# @blueSky Phase 8 管理パネル強化 設計ドキュメント

**日付:** 2026-05-16  
**スコープ:** ① ダッシュボード統計バー ② 予約一覧 検索・フィルター

---

## 概要

Phase 7 までで予約・決済・通知・UX 改善が完成した。  
Phase 8 では管理者の日常オペレーションを効率化する2機能を追加する。

---

## 変更①：ダッシュボード統計バー

### 目的

管理者がログイン直後に「今月の状況」を一目で把握できるようにする。

### 新規 API: `GET /api/admin/stats?month=YYYY-MM`

**認証:** `createSupabaseServerClient` でセッションを確認（未認証は 401）

**クエリ:**
- `reservations` テーブルから `status != 'cancelled'` かつ `checkin_date` が当月のものを取得
- `count`: 件数
- `revenue`: `total_amount` の合計
- `occupancy`: 件数 ÷ 月の日数（小数点1位、例: 0.35 → 35%）

**レスポンス:**
```json
{ "count": 8, "revenue": 128000, "occupancy": 0.26 }
```

**ファイル:** `app/api/admin/stats/route.ts`（新規）

---

### 新規コンポーネント: `components/admin/StatsBar.tsx`

- `'use client'`
- `useEffect` でマウント時に `GET /api/admin/stats?month=YYYY-MM`（当月）を呼び出す
- 3枚のカードを横並び（flex、レスポンシブ）:

| カード | アイコン | 値 |
|--------|----------|----|
| 予約件数 | 📅 | `{count}件` |
| 売上合計 | 💴 | `¥{revenue.toLocaleString()}` |
| 稼働率   | 📊 | `{Math.round(occupancy * 100)}%` |

- ローディング中はスケルトン表示（`animate-pulse`）

---

### `app/admin/(dashboard)/page.tsx` の変更

`<ReservationCalendar>` の**上**に `<StatsBar>` を挿入する。

```tsx
<StatsBar />
<ReservationCalendar />
```

---

## 変更②：予約一覧 検索・フィルター

### 目的

管理者が特定の予約を素早く見つけられるようにする。

### フィルター項目

| 項目 | UIコンポーネント | フィルタロジック |
|------|-----------------|-----------------|
| ステータス | `<select>` | 完全一致（空 = すべて） |
| チェックイン日（From） | `<input type="date">` | `checkin_date >= from` |
| チェックイン日（To） | `<input type="date">` | `checkin_date <= to` |
| ゲスト名 | `<input type="text">` | `guest_name` 部分一致（大文字小文字無視） |

### 実装方針

- **クライアントサイドフィルタリング**: APIの変更なし。既にロード済みの全件データを `useMemo` で絞り込む。
- フィルター state を `ReservationList.tsx` の先頭に追加:

```ts
const [statusFilter, setStatusFilter] = useState('')
const [fromFilter,   setFromFilter]   = useState('')
const [toFilter,     setToFilter]     = useState('')
const [nameFilter,   setNameFilter]   = useState('')

const filteredList = useMemo(() => list.filter(r => {
  if (statusFilter && r.status !== statusFilter) return false
  if (fromFilter   && r.checkin_date < fromFilter) return false
  if (toFilter     && r.checkin_date > toFilter)   return false
  if (nameFilter   && !r.guest_name.toLowerCase().includes(nameFilter.toLowerCase())) return false
  return true
}), [list, statusFilter, fromFilter, toFilter, nameFilter])
```

- テーブルは `list` の代わりに `filteredList` を `.map()` する
- フィルターUIはテーブルの上部に配置（warm-50 背景の rounded-xl カード）
- 「リセット」ボタンで全フィルターをクリア

---

## 変更ファイル一覧

```
app/api/admin/stats/route.ts            # 新規（統計API）
components/admin/StatsBar.tsx           # 新規（統計バーコンポーネント）
app/admin/(dashboard)/page.tsx          # StatsBar を追加
components/admin/ReservationList.tsx    # フィルターUI・filteredList を追加
```

---

## データ型

`StatsBar` が受け取るAPIレスポンスの型（コンポーネント内でローカル定義）:

```typescript
interface StatsData {
  count:     number
  revenue:   number
  occupancy: number
}
```

---

## テスト方針

- ビルドエラーなし（TypeScript）
- `npm test` 全テスト通過（UIコンポーネントのためユニットテスト対象外）
- ローカルで以下を手動確認:
  - `/admin` で今月の予約件数・売上・稼働率が表示されること
  - `/admin/reservations` でステータス・日付・名前でフィルタリングできること
  - フィルター「リセット」で全件表示に戻ること
