import Image from 'next/image'

const EXPERIENCES = [
  { title: '焚き火', desc: '夜空の下で揺れる炎。薪を割るところから始まる、非日常の時間。', img: 'https://images.unsplash.com/photo-1467987506553-8f3916508521?w=800', alt: '焚き火' },
  { title: 'サウナ', desc: '手作りの簡易サウナで整う。外気浴は湖畔の風が最高のご褒美。', img: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800', alt: 'サウナ' },
  { title: 'ドラム缶風呂', desc: '薪で沸かすドラム缶風呂。星空を見上げながら、身体の奥から温まる。', img: 'https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=800', alt: 'ドラム缶風呂' },
]

export default function Experience() {
  return (
    <section id="experience" className="py-20 px-4 bg-warm-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">体験</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">EXPERIENCE</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {EXPERIENCES.map(e => (
            <div key={e.title} className="rounded-2xl overflow-hidden shadow-md bg-white">
              <div className="relative h-52">
                <Image src={e.img} alt={e.alt} fill className="object-cover" unoptimized />
              </div>
              <div className="p-5">
                <h3 className="font-serif text-lg text-warm-600 font-bold mb-2">{e.title}</h3>
                <p className="text-warm-500 text-sm leading-relaxed">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
