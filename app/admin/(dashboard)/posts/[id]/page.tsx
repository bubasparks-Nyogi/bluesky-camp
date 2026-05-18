import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import PostEditor from '@/components/admin/PostEditor'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (!post) notFound()

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">記事を編集</h1>
      <PostEditor mode="edit" initial={post} />
    </div>
  )
}
