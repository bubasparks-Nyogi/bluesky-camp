// scripts/run-migration.mjs
// Supabase Management API 経由でマイグレーションを実行するスクリプト
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local から環境変数を読む
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']
const supabaseUrl    = env['NEXT_PUBLIC_SUPABASE_URL']

if (!serviceRoleKey || !supabaseUrl) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_URL が見つかりません')
  process.exit(1)
}

// Project ref を URL から抽出 (https://xxx.supabase.co → xxx)
const projectRef = supabaseUrl.replace('https://', '').split('.')[0]
console.log(`📦 Project ref: ${projectRef}`)

const sql = `
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS stay_types JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE reservations
  SET stay_types = jsonb_build_array(stay_type::text)
  WHERE stay_types = '[]'::jsonb AND stay_type IS NOT NULL;
`

console.log('🚀 マイグレーション実行中...')
console.log('SQL:', sql)

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  }
)

const text = await res.text()
console.log(`\n📊 Status: ${res.status}`)
console.log('Response:', text)

if (res.ok) {
  console.log('\n✅ マイグレーション成功！')
} else {
  console.error('\n❌ マイグレーション失敗')
  process.exit(1)
}
