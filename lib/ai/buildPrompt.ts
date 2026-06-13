export interface PromptItem {
  id: string
  name: string
  unit_price: number
}

export interface PromptMessage {
  sender: 'customer' | 'owner'
  text: string
  received_at: string
}

const SYSTEM = `あなたは @blueSky キャンプ場の注文抽出アシスタントです。
お客様とオーナーのLINE会話から、お客様が「注文した商品」だけを抽出してください。
質問・雑談・キャンセル意図は抽出しないこと。
オーナーの確認発言（「生ビール2本ですね？」）にお客様が「はい」と答えた場合は抽出します。
items 一覧から最も近い id を選び、見つからない場合は null。
confidence は 0..1 で確信度を返してください（注文無しなら空配列を返してください）。`

export function buildPrompt(input: { items: PromptItem[]; messages: PromptMessage[] }): { system: string; user: string } {
  const itemsSection = input.items
    .map(i => `- id: ${i.id}, name: ${i.name}, unit_price: ${i.unit_price}`)
    .join('\n')
  const messagesSection = input.messages
    .map(m => `[${m.sender} ${m.received_at}] ${m.text}`)
    .join('\n')
  const user = `=== items ===\n${itemsSection}\n\n=== recent messages (oldest first) ===\n${messagesSection}`
  return { system: SYSTEM, user }
}
