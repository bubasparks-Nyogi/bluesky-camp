// components/home/PhotoSlider.tsx
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos:    Photo[]
  className?: string
  interval?: number   // ミリ秒（デフォルト 4000）
}

export default function PhotoSlider({ photos, className = '', interval = 4000 }: Props) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (photos.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % photos.length)
    }, interval)
    return () => clearInterval(timer)
  }, [photos.length, interval])

  if (photos.length === 0) return null

  return (
    <div className={`relative w-full h-full ${className}`}>
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={photo.url}
            alt={photo.caption ?? '施設写真'}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
      {/* インジケーター */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
