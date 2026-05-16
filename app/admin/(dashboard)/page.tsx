import ReservationCalendar from '@/components/admin/ReservationCalendar'
import StatsBar from '@/components/admin/StatsBar'

export const metadata = { title: '予約カレンダー | @blueSky 管理' }

export default function AdminPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約カレンダー</h1>
      <StatsBar />
      <ReservationCalendar />
    </div>
  )
}
