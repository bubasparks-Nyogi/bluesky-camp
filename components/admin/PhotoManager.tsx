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

interface DriveFile {
  id: string
  name: string
  mimeType: string
  createdTime: string
  imported: boolean
}

type Section = 'hero' | 'facilities'

interface Props {
  initialPhotos: Photo[]
}

export default function PhotoManager({ initialPhotos }: Props) {
  const [photos,    setPhotos]    = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [section,   setSection]   = useState<Section>('hero')
  const [caption,   setCaption]   = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Google Drive 取込
  const [driveSection, setDriveSection] = useState<Section | null>(null)
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveImporting, setDriveImporting] = useState<string | null>(null)
  const [drivePreview, setDrivePreview] = useState<string | null>(null)
  const [driveDiag, setDriveDiag] = useState<{
    folderId?: string
    folderMeta?: { id?: string; name?: string; mimeType?: string; error?: string }
    totalEntries?: number
    subfolders?: number
    subfolderNames?: string[]
    totalFiles?: number
    imageMatched?: number
    nonImageSample?: { name: string; mimeType: string }[]
  } | null>(null)

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

  const openDrive = async (s: Section) => {
    setDriveSection(s); setError(null); setDriveFiles(null); setDriveDiag(null); setDriveLoading(true)
    try {
      const res = await fetch(`/api/admin/drive-photos?section=${s}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Drive の取得に失敗しました'); setDriveSection(null); return }
      setDriveFiles(json.files ?? [])
      setDriveDiag(json.diagnostics ?? null)
    } finally { setDriveLoading(false) }
  }

  const importFromDrive = async (f: DriveFile) => {
    if (!driveSection) return
    if (f.imported && !confirm(`「${f.name}」は取込済みです。もう一度取り込みますか？（重複表示にご注意）`)) return
    setDriveImporting(f.id); setError(null)
    try {
      const res = await fetch('/api/admin/drive-photos/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: f.id, fileName: f.name, section: driveSection }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '取込に失敗しました'); return }
      setPhotos(prev => [...prev, json.photo])
      setDriveFiles(prev => prev?.map(x => x.id === f.id ? { ...x, imported: true } : x) ?? null)
    } finally { setDriveImporting(null) }
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
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-warm-700">Hero（トップ背景）— {heroPhotos.length}枚</h3>
          <button onClick={() => openDrive('hero')}
            className="text-xs bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold px-3 py-1.5 rounded-lg">
            📁 Driveから取込
          </button>
        </div>
        <p className="text-xs text-warm-400 mb-2">写真が0枚の場合はデフォルト画像が表示されます</p>
        {heroPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={heroPhotos} sectionKey="hero" />}
      </div>

      {/* Facilities 写真一覧 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-warm-700">設備紹介 — {facilityPhotos.length}枚</h3>
          <button onClick={() => openDrive('facilities')}
            className="text-xs bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold px-3 py-1.5 rounded-lg">
            📁 Driveから取込
          </button>
        </div>
        {facilityPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={facilityPhotos} sectionKey="facilities" />}
      </div>

      {/* Drive 取込モーダル */}
      {driveSection && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setDriveSection(null); setDrivePreview(null) }}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
              <span className="text-sm font-bold text-warm-700">
                📁 Google Drive → {driveSection === 'hero' ? 'Hero（トップ背景）' : '設備紹介'} フォルダ
              </span>
              <button onClick={() => { setDriveSection(null); setDrivePreview(null) }} className="text-warm-400 hover:text-warm-600 text-xl leading-none">×</button>
            </div>

            {driveLoading ? (
              <p className="p-8 text-center text-warm-400 text-sm">取得中...</p>
            ) : !driveFiles || driveFiles.length === 0 ? (
              <div className="p-6 space-y-3">
                <p className="text-center text-warm-500 text-sm">画像として認識できるファイルがありません</p>
                {driveDiag && (
                  <div className="bg-warm-50 border border-warm-100 rounded-lg p-3 text-xs space-y-1.5">
                    <p className="text-warm-600 font-bold">診断情報</p>
                    <p>参照フォルダ ID: <span className="font-mono text-[10px] break-all">{driveDiag.folderId || '(未設定)'}</span></p>
                    <div>
                      <p>フォルダアクセス:</p>
                      {driveDiag.folderMeta?.error ? (
                        <p className="text-red-500 ml-3">❌ 失敗: {driveDiag.folderMeta.error}</p>
                      ) : (
                        <p className="text-green-600 ml-3">✅ OK: 「{driveDiag.folderMeta?.name}」({driveDiag.folderMeta?.mimeType === 'application/vnd.google-apps.folder' ? 'フォルダ' : `フォルダではない: ${driveDiag.folderMeta?.mimeType}`})</p>
                      )}
                    </div>
                    <p>フォルダ内エントリ総数: <span className="tabular-nums">{driveDiag.totalEntries}</span>（サブフォルダ {driveDiag.subfolders} / ファイル {driveDiag.totalFiles}）</p>
                    <p>画像として認識: <span className="tabular-nums">{driveDiag.imageMatched}</span></p>
                    {(driveDiag.subfolderNames?.length ?? 0) > 0 && (
                      <div className="pt-1">
                        <p className="text-warm-500">サブフォルダ例（最大5件・現状は辿りません）:</p>
                        <ul className="ml-3 text-warm-600">
                          {driveDiag.subfolderNames!.map((n, i) => <li key={i}>📁 {n}</li>)}
                        </ul>
                      </div>
                    )}
                    {(driveDiag.nonImageSample?.length ?? 0) > 0 && (
                      <div className="pt-1">
                        <p className="text-warm-500">画像以外のファイル例（最大5件）:</p>
                        <ul className="ml-3 text-warm-600">
                          {driveDiag.nonImageSample!.map((f, i) => (
                            <li key={i}>・{f.name} <span className="text-warm-400">({f.mimeType || '不明'})</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {driveDiag.folderMeta?.error && (
                      <p className="text-warm-500 pt-2 border-t border-warm-100">
                        ❌ サービスアカウントがフォルダにアクセスできていません。<br />
                        1. Drive で対象フォルダを右クリック → 共有 → サービスアカウントメール（レシートフォルダで使ったのと同じもの）を <strong>閲覧者</strong> 以上で追加<br />
                        2. env の値と URL の <code>?id=</code> の値が一致しているか確認
                      </p>
                    )}
                    {!driveDiag.folderMeta?.error && driveDiag.totalEntries === 0 && (
                      <p className="text-warm-500 pt-2 border-t border-warm-100">
                        アクセスは OK ですがフォルダが空です。Drive にファイルを追加してください。
                      </p>
                    )}
                    {!driveDiag.folderMeta?.error && (driveDiag.totalEntries ?? 0) > 0 && driveDiag.imageMatched === 0 && (
                      <p className="text-warm-500 pt-2 border-t border-warm-100">
                        フォルダ内にファイルはあるが画像として認識できません。上記のファイル種別を確認してください。<br />
                        サブフォルダ内にのみ画像がある場合は、直下に移動するか個別に共有してください（現在はサブフォルダを辿りません）。
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {driveFiles.map(f => (
                    <div key={f.id} className="border border-warm-100 rounded-lg overflow-hidden">
                      <button onClick={() => setDrivePreview(`https://drive.google.com/thumbnail?id=${f.id}&sz=w400`)}
                        className="block w-full aspect-square bg-warm-50 hover:bg-warm-100 relative overflow-hidden">
                        <img src={`https://drive.google.com/thumbnail?id=${f.id}&sz=w300`}
                          alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                      <div className="p-2">
                        <p className="text-xs text-warm-700 truncate" title={f.name}>{f.name}</p>
                        <p className="text-[10px] text-warm-400 mb-1.5">{f.createdTime.slice(0, 10)}</p>
                        <button onClick={() => importFromDrive(f)}
                          disabled={driveImporting !== null}
                          className={`w-full text-xs font-bold py-1 rounded ${f.imported
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-warm-500 hover:bg-warm-600 text-white'} disabled:opacity-40`}>
                          {driveImporting === f.id ? '取込中...' : f.imported ? '済 · 再取込' : '取り込む'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 拡大プレビュー */}
          {drivePreview && (
            <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setDrivePreview(null)}>
              <img src={drivePreview} alt="preview" className="max-w-full max-h-full rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
