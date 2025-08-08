import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

// Client for browser usage
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any

// Server client with service role for server-side operations
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null as any

// Types for our database tables
export interface Memory {
  id?: string
  created_at?: string
  user_id: string
  conversation_id?: string
  speaker: 'austin' | 'anton'
  content: string
  embedding?: number[]
  metadata?: Record<string, any>
  importance_score?: number
  tags?: string[]
}

export interface ConversationSummary {
  id?: string
  conversation_id: string
  created_at?: string
  summary: string
  key_topics?: string[]
  action_items?: string[]
  decisions?: string[]
  embedding?: number[]
}