// components/admin/PhotoManager.tsx
'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'

interface Photo {
  id:         string
  url:        string
  caption:    string | null
  section:    string
  sort_order: number
}

interface Props {
  initialPhotos: Photo[]
}

export default function PhotoManager({ initialPhotos }: Props) {
  const [photos,    setPhotos]    = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [section,   setSection]   = useState<'hero' | 'facilities'>('hero')
  const [caption,   setCaption]   = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const heroPhotos     = photos.filter(p => p.section === 'hero')
  const facilityPhotos = photos.filter(p => p.section === 'facilities')

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file',    file)
    fd.append('section', section)
    if (caption) fd.append('caption', caption)

    const res  = await fetch('/api/admin/photos', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'アップロード失敗'); setUploading(false); return }

    setPhotos(prev => [...prev, data.photo])
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この写真を削除しますか？')) return
    await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const handleMove = async (id: string, direction: 'up' | 'down', sectionKey: string) => {
    const sectionPhotos = photos
      .filter(p => p.section === sectionKey)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx     = sectionPhotos.findIndex(p => p.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sectionPhotos.length) return

    const a = sectionPhotos[idx]
    const b = sectionPhotos[swapIdx]
    await Promise.all([
      fetch(`/api/admin/photos/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/admin/photos/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ])
    setPhotos(prev => prev.map(p =>
      p.id === a.id ? { ...p, sort_order: b.sort_order } :
      p.id === b.id ? { ...p, sort_order: a.sort_order } : p
    ))
  }

  const PhotoGrid = ({ items, sectionKey }: { items: Photo[], sectionKey: string }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      {items.sort((a, b) => a.sort_order - b.sort_order).map((photo, i) => (
        <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
          <div className="relative w-full h-32">
            <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
          </div>
          <div className="p-2">
            <p className="text-xs text-warm-500 truncate">{photo.caption ?? '(キャプションなし)'}</p>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => handleMove(photo.id, 'up', sectionKey)}
                className="text-xs text-warm-400 hover:text-warm-600 border border-warm-200 px-1 rounded"
                disabled={i === 0}
              >↑</button>
              <button
                onClick={() => handleMove(photo.id, 'down', sectionKey)}
                className="text-xs text-warm-400 hover:text-warm-600 border border-warm-200 px-1 rounded"
                disabled={i === items.length - 1}
              >↓</button>
              <button
                onClick={() => handleDelete(photo.id)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-1 rounded ml-auto"
              >削除</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* アップロードフォーム */}
      <div className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-bold text-warm-700 mb-4">写真をアップロード</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-warm-400 mb-1">セクション</label>
            <select
              value={section}
              onChange={e => setSection(e.target.value as 'hero' | 'facilities')}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400"
            >
              <option value="hero">Hero（トップ背景）</option>
              <option value="facilities">設備紹介</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">キャプション（任意）</label>
            <input
              type="text" value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="写真の説明..."
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400 w-48"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">ファイル</label>
            <input
              ref={fileRef} type="file" accept="image/*"
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white"
            />
          </div>
          <button
            onClick={handleUpload} disabled={uploading}
            className="bg-warm-300 hover:bg-warm-400 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {uploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* Hero 写真一覧 */}
      <div>
        <h3 className="font-bold text-warm-700 mb-1">Hero（トップ背景）— {heroPhotos.length}枚</h3>
        <p className="text-xs text-warm-400 mb-2">写真が0枚の場合はデフォルト画像が表示されます</p>
        {heroPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={heroPhotos} sectionKey="hero" />}
      </div>

      {/* Facilities 写真一覧 */}
      <div>
        <h3 className="font-bold text-warm-700 mb-1">設備紹介 — {facilityPhotos.length}枚</h3>
        {facilityPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={facilityPhotos} sectionKey="facilities" />}
      </div>
    </div>
  )
}
