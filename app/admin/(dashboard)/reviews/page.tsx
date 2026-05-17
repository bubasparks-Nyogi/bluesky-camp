import { supabaseAdmin } from '@/lib/supabase'
import ReviewManager from '@/components/admin/ReviewManager'

async function getAllReviews() {
  const { data } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminReviewsPage() {
  const reviews = await getAllReviews()
  const pending   = reviews.filter(r => !r.is_published).length
  const published = reviews.filter(r =>  r.is_published).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">レビュー管理</h1>
        <div className="flex gap-4 text-sm text-warm-500">
          <span>未承認: <strong className="text-orange-500">{pending}</strong></span>
          <span>公開中: <strong className="text-green-600">{published}</strong></span>
        </div>
      </div>
      <ReviewManager initialReviews={reviews} />
    </div>
  )
}
