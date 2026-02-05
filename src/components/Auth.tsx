/**
 * User authentication component
 * Supports Email/Password and OAuth (Google, GitHub)
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import { Mail, Lock, Github, Chrome as ChromeIcon, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '@/hooks/useAuth';

export interface AuthProps {
  onSuccess?: () => void;
}

/**
 * Authentication component with email/password and OAuth support
 */
export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const { signIn, signUp, signInWithOAuth, isConfigured } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Check if Supabase is configured
  if (!isConfigured) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          Supabase Not Configured
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Please configure Supabase credentials in your environment variables.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
        </p>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error: authError } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authError) {
        setError(authError.message);
      } else {
        // Success - onSuccess will be called via auth state change
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    setError(null);

    try {
      const { error: oauthError } = await signInWithOAuth(provider);
      if (oauthError) {
        setError(oauthError.message);
      }
      // OAuth flow will complete in background
      // onSuccess will be called when auth state changes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth sign in failed');
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {isLogin ? 'Sign In' : 'Sign Up'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isLogin
            ? 'Sign in to sync your data across devices'
            : 'Create an account to get started'}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* OAuth buttons */}
      <div className="space-y-2 mb-6">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => handleOAuth('google')}
          disabled={loading || oauthLoading !== null}
          isLoading={oauthLoading === 'google'}
          leftIcon={<ChromeIcon className="w-4 h-4" />}
        >
          Continue with Google
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => handleOAuth('github')}
          disabled={loading || oauthLoading !== null}
          isLoading={oauthLoading === 'github'}
          leftIcon={<Github className="w-4 h-4" />}
        >
          Continue with GitHub
        </Button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-9 w-4 h-4 text-gray-400" />
          <Input
            type="email"
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || oauthLoading !== null}
            className="pl-10"
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-9 w-4 h-4 text-gray-400" />
          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || oauthLoading !== null}
            className="pl-10"
            required
          />
        </div>

        {!isLogin && (
          <div className="relative">
            <Lock className="absolute left-3 top-9 w-4 h-4 text-gray-400" />
            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || oauthLoading !== null}
              className="pl-10"
              required
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={loading}
          disabled={oauthLoading !== null}
        >
          {isLogin ? 'Sign In' : 'Sign Up'}
        </Button>
      </form>

      {/* Toggle login/signup */}
      <div className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setPassword('');
            setConfirmPassword('');
          }}
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
          disabled={loading || oauthLoading !== null}
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>

      {/* Info */}
      <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          <strong>Note:</strong> Your data is encrypted and stored securely. You can use the
          extension without signing in, but signing in enables cloud sync across devices.
        </p>
      </div>
    </div>
  );
};
