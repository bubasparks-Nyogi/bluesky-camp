import PostEditor from '@/components/admin/PostEditor'

export default function NewPostPage() {
  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">新規投稿</h1>
      <PostEditor mode="create" />
    </div>
  )
}
