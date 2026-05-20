import { supabaseAdmin } from '@/lib/supabase'
import ReviewManager from '@/components/admin/ReviewManager'
import ReviewFilters from '@/components/admin/ReviewFilters'

interface Props {
  searchParams: { q?: string; publish?: string }
}

export default async function AdminReviewsPage({ searchParams }: Props) {
  let query = supabaseAdmin.from('reviews').select('*').order('created_at', { ascending: false })

  if (searchParams.q) {
    const pat = `%${searchParams.q}%`
    query = query.or(`guest_name.ilike.${pat},comment.ilike.${pat}`)
  }
  if (searchParams.publish === 'published')   query = query.eq('is_published', true)
  if (searchParams.publish === 'unpublished') query = query.eq('is_published', false)

  const { data: reviews } = await query
  const reviewList = reviews ?? []
  const pending   = reviewList.filter(r => !r.is_published).length
  const published = reviewList.filter(r =>  r.is_published).length

  const { count: totalCount } = await supabaseAdmin.from('reviews').select('*', { count: 'exact', head: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">レビュー管理</h1>
        <div className="flex gap-4 text-sm text-warm-500">
          <span>未承認: <strong className="text-orange-500">{pending}</strong></span>
          <span>公開中: <strong className="text-green-600">{published}</strong></span>
        </div>
      </div>
      <ReviewFilters totalCount={totalCount ?? 0} visibleCount={reviewList.length} />
      <ReviewManager initialReviews={reviewList} />
    </div>
  )
}
