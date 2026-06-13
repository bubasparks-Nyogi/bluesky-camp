import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, type PromptItem, type PromptMessage } from './buildPrompt'
import { parseExtractResponse, type ExtractedLine } from './parseExtractResponse'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 4000

const TOOL = {
  name: 'extract_sale_drafts',
  description: 'お客様の注文を構造化して返す',
  input_schema: {
    type: 'object' as const,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          required: ['itemId', 'itemNameRaw', 'quantity', 'confidence'],
          properties: {
            itemId:      { type: ['string', 'null'] as const },
            itemNameRaw: { type: 'string' as const },
            quantity:    { type: 'number' as const },
            unitPrice:   { type: ['number', 'null'] as const },
            confidence:  { type: 'number' as const, minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
}

export async function extractSaleDrafts(input: { items: PromptItem[]; messages: PromptMessage[] }): Promise<ExtractedLine[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.warn('[extractSaleDrafts] ANTHROPIC_API_KEY not set'); return [] }
  const { system, user } = buildPrompt(input)
  const validItemIds = new Set(input.items.map(i => i.id))
  const client = new Anthropic({ apiKey })
  try {
    const result = await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        system,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: user }],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
    ])
    const toolUse = result.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return []
    return parseExtractResponse(toolUse.input as { lines?: unknown[] } as never, validItemIds)
  } catch (e) {
    console.warn('[extractSaleDrafts] failed:', e instanceof Error ? e.message : e)
    return []
  }
}
