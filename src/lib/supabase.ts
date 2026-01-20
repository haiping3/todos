/**
 * Supabase client configuration for Chrome extension
 * @author haiping.yu@zoom.us
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment variables - set in build or from storage
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create Supabase client instance
 * Uses Chrome storage for session persistence
 */
export async function getSupabaseClient(): Promise<SupabaseClient<Database> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase credentials not configured');
    return null;
  }

  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storage: {
        getItem: async (key: string) => {
          const result = await chrome.storage.local.get(key);
          return result[key] ?? null;
        },
        setItem: async (key: string, value: string) => {
          await chrome.storage.local.set({ [key]: value });
        },
        removeItem: async (key: string) => {
          await chrome.storage.local.remove(key);
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get Supabase configuration status
 */
export async function getSupabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  user: unknown | null;
}> {
  if (!isSupabaseConfigured()) {
    return { configured: false, connected: false, user: null };
  }

  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { configured: true, connected: false, user: null };
    }

    const { data: { user } } = await client.auth.getUser();
    return { configured: true, connected: true, user };
  } catch {
    return { configured: true, connected: false, user: null };
  }
}

