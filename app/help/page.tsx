import type { Metadata } from 'next'
import { promises as fs } from 'fs'
import path from 'path'
import Link from 'next/link'
import PostBody from '@/components/PostBody'

export const metadata: Metadata = {
  title: '使い方ガイド | @blueSky',
  description: '@blueSky のご予約・変更・チェックインの手順をご案内します。',
}

async function getGuide(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'customer-guide.md')
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return '# 使い方ガイド\n\nガイドの読み込みに失敗しました。'
  }
}

export default async function HelpPage() {
  const content = await getGuide()
  return (
    <main className="min-h-screen bg-warm-50">
      <header className="bg-warm-700 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">使い方ガイド</span>
      </header>

      <div className="max-w-3xl mx-auto p-4 lg:p-8">
        <article className="bg-white border border-warm-100 rounded-2xl p-6 md:p-8">
          <PostBody markdown={content} />
        </article>
      </div>
    </main>
  )
}
