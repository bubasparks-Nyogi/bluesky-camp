import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AdminNav from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/admin/login')

  return (
    <div className="min-h-screen lg:h-screen lg:flex lg:overflow-hidden bg-warm-50">
      <AdminNav />
      <main className="flex-1 lg:overflow-y-auto p-4 lg:p-8">{children}</main>
    </div>
  )
}
