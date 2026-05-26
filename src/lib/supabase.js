import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Usa sessionStorage para que a sessão expire ao fechar o browser/aba
const authStorage = typeof window !== 'undefined'
  ? {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key),
  }
  : undefined

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: authStorage,
    },
  })
  : null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  return supabase
}
