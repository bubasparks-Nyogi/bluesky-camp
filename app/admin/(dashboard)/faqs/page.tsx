// app/admin/(dashboard)/faqs/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import FaqManager from '@/components/admin/FaqManager'

export const metadata = { title: 'FAQ管理 | @blueSky 管理' }

export default async function FaqsPage() {
  const { data } = await supabaseAdmin
    .from('faqs').select('*').order('category').order('sort_order')

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">FAQ管理</h1>
      <FaqManager initialFaqs={data ?? []} />
    </div>
  )
}
