import Hero            from '@/components/home/Hero'
import Experience      from '@/components/home/Experience'
import Facilities      from '@/components/home/Facilities'
import Plan            from '@/components/home/Plan'
import Rules          from '@/components/home/Rules'
import BookingCalendar from '@/components/home/BookingCalendar'
import Access          from '@/components/home/Access'
import Contact         from '@/components/home/Contact'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Experience />
      <Facilities />
      <Plan />
      <Rules />
      <section id="booking" className="py-20 px-4 bg-warm-100">
        <div className="max-w-sm mx-auto text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-warm-600 mb-2">空き確認</h2>
          <p className="text-warm-400 mb-10 text-sm tracking-widest">BOOKING</p>
          <BookingCalendar />
        </div>
      </section>
      <Access />
      <Contact />
      <footer className="bg-warm-700 text-warm-300 text-center py-6 text-xs">
        <p>© 2026 @blueSky. All rights reserved.</p>
        <p className="mt-1">滋賀県高島市安曇川町川島1478-5</p>
      </footer>
    </main>
  )
}
