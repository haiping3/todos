/**
 * Authentication state management hook
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
}

export interface UseAuthResult extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

/**
 * Hook for managing authentication state
 */
export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isConfigured: false,
  });

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const configured = isSupabaseConfigured();
      
      if (!configured) {
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          isConfigured: false,
        });
        return;
      }

      try {
        const client = await getSupabaseClient();
        if (!client) {
          setState({
            user: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            isConfigured: true,
          });
          return;
        }

        // Get initial session
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }

        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session,
          isConfigured: true,
        });

        // Auto-create profile for initial session
        if (session?.user) {
          ensureUserProfile(client, session.user).catch((err) => {
            console.warn('Failed to create profile:', err);
          });
        }

        // Listen for auth changes
        const { data: { subscription } } = client.auth.onAuthStateChange(
          async (_event, session) => {
            setState({
              user: session?.user ?? null,
              session,
              isLoading: false,
              isAuthenticated: !!session,
              isConfigured: true,
            });

            // Auto-create profile when user signs in
            if (session?.user) {
              ensureUserProfile(client, session.user).catch((err) => {
                console.warn('Failed to create profile:', err);
              });
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          isConfigured: true,
        });
      }
    };

    initAuth();
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Sign in failed') };
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string) => {
    const client = await getSupabaseClient();
    if (!client) {
      return { error: new Error('Supabase not configured') };
    }

    try {
      const { error } = await client.auth.signUp({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Sign up failed') };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    const client = await getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  }, []);

  // Sign in with OAuth (Google/GitHub)
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    const client = await getSupabaseClient();
    if (!client) {
      return { error: new Error('Supabase not configured') };
    }

    return new Promise<{ error: Error | null }>((resolve) => {
      try {
        // Get redirect URL for Chrome extension
        const redirectUrl = chrome.identity.getRedirectURL();
        
        client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        }).then(({ data, error }) => {
          if (error) {
            resolve({ error: new Error(error.message) });
            return;
          }

          if (!data?.url) {
            resolve({ error: new Error('No OAuth URL returned') });
            return;
          }

          // Open OAuth URL using Chrome identity API
          chrome.identity.launchWebAuthFlow(
            {
              url: data.url,
              interactive: true,
            },
            async (callbackUrl) => {
              if (chrome.runtime.lastError) {
                resolve({ error: new Error(chrome.runtime.lastError.message) });
                return;
              }

              if (!callbackUrl) {
                resolve({ error: new Error('OAuth cancelled') });
                return;
              }

              try {
                // Parse the callback URL
                const url = new URL(callbackUrl);
                
                // Supabase OAuth callback contains tokens in hash fragment
                const hash = url.hash.substring(1); // Remove #
                const hashParams = new URLSearchParams(hash);
                
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const error = hashParams.get('error') || url.searchParams.get('error');

                if (error) {
                  resolve({ error: new Error(`OAuth error: ${error}`) });
                  return;
                }

                if (accessToken && refreshToken) {
                  // Set the session with tokens
                  const { error: sessionError } = await client.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });

                  if (sessionError) {
                    resolve({ error: new Error(sessionError.message) });
                    return;
                  }

                  // Success - session is set, auth state will update automatically
                  resolve({ error: null });
                } else {
                  resolve({ error: new Error('No tokens in OAuth callback') });
                }
              } catch (parseError) {
                resolve({ 
                  error: parseError instanceof Error 
                    ? parseError 
                    : new Error('Failed to parse OAuth callback') 
                });
              }
            }
          );
        });
      } catch (error) {
        resolve({ 
          error: error instanceof Error 
            ? error 
            : new Error('OAuth sign in failed') 
        });
      }
    });
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const client = await getSupabaseClient();
    if (client) {
      await client.auth.refreshSession();
    }
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    refreshSession,
  };
}

/**
 * Ensure user profile exists in database
 * Creates profile if it doesn't exist
 */
async function ensureUserProfile(
  client: SupabaseClient<Database>,
  user: User
): Promise<void> {
  try {
    // Check if profile exists
    const { data: existingProfile } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile) {
      // Profile already exists
      return;
    }

    // Create new profile
    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      user_id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      settings: {} as Record<string, unknown>,
    };
    // Type assertion needed due to Supabase type inference limitations
    const { error } = await (client.from('profiles') as unknown as {
      insert: (values: Database['public']['Tables']['profiles']['Insert']) => Promise<{ error: { message: string; code?: string } | null }>;
    }).insert(profileData);

    if (error) {
      // Ignore duplicate key errors (race condition)
      if (error.code !== '23505') {
        console.error('Failed to create user profile:', error);
      }
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    // Don't throw - profile creation is not critical for app functionality
  }
}
