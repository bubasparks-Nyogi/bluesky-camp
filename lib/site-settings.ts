import { supabaseAdmin } from './supabase'

export interface SiteSettings {
  checkinTime: string
  checkoutTime: string
  address: string
  phone: string
  guideNote: string
  accessNote: string
}

const EMPTY: SiteSettings = {
  checkinTime: '', checkoutTime: '', address: '', phone: '', guideNote: '', accessNote: '',
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data } = await supabaseAdmin
    .from('site_settings').select('checkin_time, checkout_time, address, phone, guide_note, access_note')
    .eq('id', 1).maybeSingle()
  if (!data) return EMPTY
  return {
    checkinTime:  data.checkin_time  ?? '',
    checkoutTime: data.checkout_time ?? '',
    address:      data.address       ?? '',
    phone:        data.phone         ?? '',
    guideNote:    data.guide_note    ?? '',
    accessNote:   data.access_note   ?? '',
  }
}
