import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    // We don't throw to avoid crashing the whole app if envs are missing during development check
    console.warn('Missing Supabase environment variables')
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
)
