import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
export const isSupabaseConfigured = Boolean(supabase)
