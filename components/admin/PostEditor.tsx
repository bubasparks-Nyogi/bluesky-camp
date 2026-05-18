'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Post {
  id?: string
  slug?: string
  title?: string
  excerpt?: string | null
  body?: string
  cover_image?: string | null
  category?: string
  is_published?: boolean
}

interface Props {
  initial?: Post
  mode: 'create' | 'edit'
}

const CATEGORIES = [
  { value: 'news',  label: 'お知らせ' },
  { value: 'event', label: 'イベント' },
  { value: 'blog',  label: 'ブログ' },
]

export default function PostEditor({ initial, mode }: Props) {
  const router = useRouter()
  const [title,       setTitle]       = useState(initial?.title       ?? '')
  const [slug,        setSlug]        = useState(initial?.slug        ?? '')
  const [excerpt,     setExcerpt]     = useState(initial?.excerpt     ?? '')
  const [body,        setBody]        = useState(initial?.body        ?? '')
  const [coverImage,  setCoverImage]  = useState(initial?.cover_image ?? '')
  const [category,    setCategory]    = useState(initial?.category    ?? 'news')
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title,
        body,
        excerpt:     excerpt     || null,
        cover_image: coverImage  || null,
        category,
        slug:        slug || undefined,
        is_published: isPublished,
      }
      const url    = mode === 'create' ? '/api/admin/posts' : `/api/admin/posts/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '保存に失敗しました'); return }
      router.push('/admin/posts')
      router.refresh()
    } catch {
      setError('保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div>
        <label className="block text-sm text-warm-500 mb-1">タイトル <span className="text-red-400">*</span></label>
        <input
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">スラッグ（URL）<span className="text-warm-300 text-xs">省略時はタイトルから生成</span></label>
        <input
          type="text"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="例: summer-event-2026"
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">カテゴリ</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">カバー画像URL</label>
        <input
          type="url"
          value={coverImage}
          onChange={e => setCoverImage(e.target.value)}
          placeholder="https://..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">要約（一覧表示用）</label>
        <textarea
          rows={2}
          value={excerpt}
          onChange={e => setExcerpt(e.target.value)}
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">本文（Markdown）<span className="text-red-400">*</span></label>
        <textarea
          required
          rows={16}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="## 見出し&#10;&#10;本文をMarkdownで書いてください..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 font-mono text-sm resize-y"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="is_published"
          type="checkbox"
          checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="is_published" className="text-sm text-warm-600">公開する</label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : (mode === 'create' ? '作成する' : '更新する')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/posts')}
          className="px-4 py-2.5 border border-warm-200 text-warm-500 hover:bg-warm-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
