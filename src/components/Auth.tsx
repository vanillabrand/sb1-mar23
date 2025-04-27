import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Check,
  Github,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Hero } from './Hero';
import { Reviews } from './Reviews';
import { Awards } from './Awards';
// Define types locally to avoid import errors
type AuthMode = 'sign_in' | 'sign_up' | 'forgotten_password';

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface AuthState {
  loading: boolean;
  error: AuthError | null;
  success: string | null;
}

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'empty'>('empty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<AuthState>({
    loading: false,
    error: null,
    success: null
  });

  const handleModeChange = (newMode: 'login' | 'signup' | 'forgot' | 'empty') => {
    setMode(newMode);
    setState(prev => ({ ...prev, error: null, success: null }));
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const validateForm = (): boolean => {
    if (!email || !password) {
      setState(prev => ({
        ...prev,
        error: 'Please fill in all required fields'
      }));
      return false;
    }

    if (mode === 'signup' && password.length < 8) {
      setState(prev => ({
        ...prev,
        error: 'Password must be at least 8 characters long'
      }));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let mounted = true;

      switch (mode) {
        case 'login': {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (loginError) throw loginError;
          break;
        }

        case 'signup': {
          const { error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin
            }
          });
          if (signupError) throw signupError;
          if (mounted) {
            setState(prev => ({
              ...prev,
              success: 'Account created! Please check your email to verify your account.'
            }));
          }
          break;
        }
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setState(prev => ({
          ...prev,
          error: err.message
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'An unexpected error occurred'
        }));
      }
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to sign in with GitHub'
      }));
    }
  };

  const handleDiscordSignIn = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to sign in with Discord'
      }));
    }
  };

  if (mode === 'empty') {
    return (
      <div className="min-h-screen overflow-hidden">
        {/* Hero Section */}
        <Hero />

        {/* Reviews Section */}
        <Reviews />

        {/* Awards Section */}
        <Awards />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gunmetal-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold gradient-text">
            {mode === 'login' ? 'Welcome Back' :
             mode === 'signup' ? 'Create Account' :
             'Reset Password'}
          </h2>
          <p className="mt-2 text-gray-400">
            {mode === 'login' ? 'Sign in to access your account' :
             mode === 'signup' ? 'Join thousands of traders using AI' :
             'Enter your email to reset your password'}
          </p>
        </div>

        {state.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5" />
            {state.success}
          </div>
        )}

        {/* OAuth Providers */}
        <div className="space-y-3">
          <button
            onClick={handleGitHubSignIn}
            disabled={state.loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-[#24292e] text-white rounded-lg hover:bg-[#2f363d] transition-all duration-300 disabled:opacity-50"
          >
            <Github className="w-5 h-5" />
            Continue with GitHub
          </button>

          <button
            onClick={handleDiscordSignIn}
            disabled={state.loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-all duration-300 disabled:opacity-50"
          >
            <MessageSquare className="w-5 h-5" />
            Continue with Discord
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gunmetal-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gunmetal-950 text-gray-400">Or continue with email</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                  placeholder="Email address"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === 'signup' ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                    placeholder={mode === 'signup' ? "Create password" : "Password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={state.loading}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-neon-turquoise hover:bg-neon-yellow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-turquoise transition-all duration-300"
            >
              {state.loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' && <LogIn className="w-5 h-5 mr-2" />}
                  {mode === 'signup' && <User className="w-5 h-5 mr-2" />}
                  {mode === 'login' ? 'Sign In' :
                   mode === 'signup' ? 'Create Account' :
                   'Reset Password'}
                </>
              )}
            </motion.button>
          </div>

          <div className="flex flex-col items-center gap-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => handleModeChange('forgot')}
                  className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors"
                >
                  Forgot your password?
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('signup')}
                  className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors"
                >
                  Need an account? Sign up
                </button>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className="text-sm text-gray-400 hover:text-neon-turquoise transition-colors"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
