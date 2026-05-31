import { promises as fs } from 'fs'
import path from 'path'
import PostBody from '@/components/PostBody'
import PrintButton from '@/components/admin/PrintButton'

async function getManual(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'operations-manual.md')
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return '# 運用手順書\n\n手順書ファイルを読み込めませんでした。`docs/operations-manual.md` を確認してください。'
  }
}

export const metadata = { title: '運用手順書' }

export default async function ManualPage() {
  const content = await getManual()
  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-serif font-bold text-warm-700">運用手順書</h1>
        <PrintButton />
      </div>
      <article className="bg-white border border-warm-100 rounded-xl p-6 md:p-8 print:border-0 print:p-0">
        <PostBody markdown={content} />
      </article>
    </div>
  )
}
