import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const configured = !!url && !!key && !url.includes('YOUR-PROJECT')
export const supabase = createClient(configured ? url : 'http://localhost', configured ? key : 'x')
export const photoUrl = (p: string) => supabase.storage.from('photos').getPublicUrl(p).data.publicUrl
export async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const r = await supabase.auth.signInAnonymously()
  if (r.error) throw r.error
  return r.data.user!
}
