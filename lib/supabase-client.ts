/**
 * Supabaseクライアント（シングルトン）
 * プロトタイプ用。認証なしでpublishableキーを使用。
 * クライアント側でのみ初期化されるよう遅延生成する。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
    },
  })
  return client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop)
  },
})
