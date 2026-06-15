import { promises as fs } from 'fs'
import path from 'path'
import PostBody from '@/components/PostBody'
import PrintButton from '@/components/admin/PrintButton'

export const metadata = { title: '使い方ガイド | @blueSky 管理' }

async function getGuide(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'admin-usage-guide.md')
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return '# 使い方ガイド\n\nガイドの読み込みに失敗しました。'
  }
}

export default async function AdminUsageGuidePage() {
  const content = await getGuide()
  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-serif font-bold text-warm-700">📖 使い方ガイド</h1>
        <PrintButton />
      </div>
      <article className="bg-white border border-warm-100 rounded-xl p-6 md:p-8 print:border-0 print:p-0">
        <PostBody markdown={content} />
      </article>
    </div>
  )
}
