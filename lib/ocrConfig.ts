// OCR に使う Claude モデル。差し替えやすいよう定数化。
// Haiku 4.5: 構造化抽出（レシート・注文）に向いており、B-7b でも実績あり。安価・高速。
export const OCR_MODEL = 'claude-haiku-4-5-20251001'
export const OCR_MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10MB
