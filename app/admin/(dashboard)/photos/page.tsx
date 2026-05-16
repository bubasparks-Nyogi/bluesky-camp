// app/admin/(dashboard)/photos/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import PhotoManager from '@/components/admin/PhotoManager'

export const metadata = { title: '写真管理 | @blueSky 管理' }

export default async function PhotosPage() {
  const { data } = await supabaseAdmin
    .from('photos').select('*').order('section').order('sort_order')

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">写真管理</h1>
      <PhotoManager initialPhotos={data ?? []} />
    </div>
  )
}
