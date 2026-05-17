import { supabaseAdmin } from '@/lib/supabase'
import ReviewForm from './ReviewForm'

interface Review {
  id: string
  guest_name: string
  rating: number
  comment: string
  visit_date: string | null
  created_at: string
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}つ星`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= rating ? 'text-yellow-400' : 'text-warm-200'}>★</span>
      ))}
    </span>
  )
}

async function getReviews(): Promise<Review[]> {
  const { data } = await supabaseAdmin
    .from('reviews')
    .select('id, guest_name, rating, comment, visit_date, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ReviewSection() {
  const reviews = await getReviews()

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <section id="reviews" className="py-20 px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-serif text-2xl md:text-3xl text-warm-600 mb-2">クチコミ</h2>
          <p className="text-warm-400 text-sm tracking-widest mb-4">REVIEWS</p>
          {avgRating && (
            <div className="inline-flex items-center gap-2 bg-warm-50 border border-warm-200 rounded-full px-4 py-2">
              <span className="text-yellow-400 text-lg">★</span>
              <span className="font-bold text-warm-700 text-lg">{avgRating}</span>
              <span className="text-warm-400 text-sm">/ 5（{reviews.length}件）</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="text-center text-warm-300 text-sm py-8">まだクチコミはありません</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-warm-50 rounded-xl p-5 border border-warm-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-warm-700 text-sm">{r.guest_name}</span>
                  <StarDisplay rating={r.rating} />
                </div>
                <p className="text-warm-600 text-sm leading-relaxed">{r.comment}</p>
                {r.visit_date && (
                  <p className="text-warm-300 text-xs mt-2">{r.visit_date} ご宿泊</p>
                )}
              </div>
            ))}
          </div>
        )}

        <ReviewForm />
      </div>
    </section>
  )
}
