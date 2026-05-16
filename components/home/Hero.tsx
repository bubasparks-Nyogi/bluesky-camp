// components/home/Hero.tsx
import Image from 'next/image'
import Link from 'next/link'
import PhotoSlider from '@/components/home/PhotoSlider'

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos?: Photo[]
}

export default function Hero({ photos = [] }: Props) {
  const FALLBACK = 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600'

  return (
    <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {photos.length > 0 ? (
        <div className="absolute inset-0 brightness-50">
          <PhotoSlider photos={photos} className="w-full h-full" />
        </div>
      ) : (
        <Image
          src={FALLBACK}
          alt="焚き火のある夜のキャンプ場"
          fill
          className="object-cover brightness-50"
          priority
          unoptimized
        />
      )}
      <div className="relative z-10 text-center text-white px-4">
        <p className="text-sm md:text-base tracking-[0.3em] mb-4 text-warm-200">
          SHIGA / TAKASHIMA
        </p>
        <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-bold leading-snug mb-6">
          忙しい日常から<br />非日常へ。
        </h1>
        <p className="text-base md:text-lg text-warm-100 mb-8 max-w-md mx-auto">
          滋賀・高島市、一日一組限定。<br />
          焚き火・サウナ・ドラム缶風呂が待っています。
        </p>
        <Link href="#booking"
              className="inline-block bg-warm-300 hover:bg-warm-400 text-white font-bold px-8 py-3 rounded-full transition-colors text-base shadow-lg">
          空き状況を確認する
        </Link>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-xs tracking-widest animate-bounce">
        SCROLL ↓
      </div>
    </section>
  )
}
