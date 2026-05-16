// components/home/Facilities.tsx
import PhotoSlider from '@/components/home/PhotoSlider'

const ITEMS = [
  { icon: '🏕', label: 'テント設営スペース' },
  { icon: '🚌', label: 'キャンピングトレーラー 2棟' },
  { icon: '🚿', label: 'シャワー完備' },
  { icon: '🌡', label: 'ドラム缶風呂' },
  { icon: '🧖', label: '簡易サウナ' },
  { icon: '🐕', label: 'ペット可（小型犬まで）' },
  { icon: '📶', label: 'Wi-Fi完備' },
  { icon: '🔌', label: 'EHU外部電源（キャンピングカー用）' },
  { icon: '🚗', label: '駐車場あり' },
  { icon: '🎒', label: 'キャンプ道具レンタル' },
  { icon: '🚐', label: '送迎サービス' },
]

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos?: Photo[]
}

export default function Facilities({ photos = [] }: Props) {
  return (
    <section id="facilities" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">設備</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">FACILITIES</p>

        {/* 施設写真スライドショー */}
        {photos.length > 0 && (
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-12">
            <PhotoSlider photos={photos} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {ITEMS.map(item => (
            <div key={item.label} className="flex flex-col items-center gap-2 p-4 bg-warm-50 rounded-xl text-center">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-warm-600 leading-snug">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
