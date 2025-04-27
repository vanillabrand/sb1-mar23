import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, type AuthError } from '@supabase/supabase-js';
import { supabase, refreshSession } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { logService } from '../lib/log-service';
import { userProfileService } from '../lib/user-profile-service';
import { exchangeService } from '../lib/exchange-service';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  toggleDemoMode: () => void;
  signInWithGithub: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('useAuth: Initializing auth context');

        // First check localStorage for a cached user
        const cachedUserStr = localStorage.getItem('sb-user');
        let cachedUser = null;

        if (cachedUserStr) {
          try {
            cachedUser = JSON.parse(cachedUserStr);
            console.log('useAuth: Found cached user:', cachedUser);

            // Set the user from cache immediately to avoid flicker
            if (mounted && cachedUser) {
              setUser(cachedUser);

              // Initialize services with cached user
              userProfileService.initialize(cachedUser.id);

              // Don't await this to avoid blocking the UI
              exchangeService.initialize().catch(err => {
                console.error('Failed to initialize exchange service from cache:', err);
              });
            }
          } catch (e) {
            console.error('useAuth: Failed to parse cached user:', e);
            localStorage.removeItem('sb-user');
          }
        }

        // Get the current session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('useAuth: Initial session check:', { session, error: sessionError });

        if (sessionError) {
          console.error('useAuth: Session error:', sessionError);
          throw sessionError;
        }

        if (mounted) {
          const sessionUser = session?.user ?? null;
          console.log('useAuth: Setting initial user state from session:', sessionUser);

          if (sessionUser) {
            setUser(sessionUser);

            // Cache the user in localStorage
            localStorage.setItem('sb-user', JSON.stringify(sessionUser));

            // Initialize user profile service
            userProfileService.initialize(sessionUser.id);

            // Create user profile if it doesn't exist
            try {
              const profile = await userProfileService.getUserProfile();
              if (!profile) {
                await userProfileService.saveUserProfile({
                  email: sessionUser.email,
                  auto_reconnect: true
                });
              }

              // Initialize exchange service
              await exchangeService.initialize();
            } catch (profileError) {
              console.error('Failed to initialize user profile:', profileError);
              logService.error('Failed to initialize user profile', profileError, 'AuthProvider');
            }
          } else if (cachedUser) {
            // If we have a cached user but no session, try to refresh the session
            try {
              logService.log('info', 'Attempting to refresh session with cached user', { userId: cachedUser.id }, 'AuthProvider');
              const success = await refreshSession();

              if (!success) {
                logService.log('warn', 'Failed to refresh session with cached user', null, 'AuthProvider');
                // Clear cached user if refresh fails
                localStorage.removeItem('sb-user');
                setUser(null);
              } else {
                // Get the updated session after refresh
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                  logService.log('info', 'Session refreshed successfully', { userId: session.user.id }, 'AuthProvider');
                  setUser(session.user);

                  // Initialize user profile service
                  userProfileService.initialize(session.user.id);

                  // Initialize exchange service
                  await exchangeService.initialize();
                }
              }
            } catch (refreshError) {
              logService.log('error', 'Exception refreshing session', refreshError, 'AuthProvider');
              localStorage.removeItem('sb-user');
              setUser(null);
            }
          }
        }

        logService.log('info', 'Setting up auth state change listener', null, 'AuthProvider');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          logService.log('info', 'Auth state changed', { event, userId: session?.user?.id }, 'AuthProvider');

          if (mounted) {
            const currentUser = session?.user ?? null;

            if (currentUser) {
              setUser(currentUser);
              // Cache the user in localStorage
              localStorage.setItem('sb-user', JSON.stringify(currentUser));
              logService.log('info', 'User state updated after auth change', { userId: currentUser.id }, 'AuthProvider');

              // Initialize user profile service when user logs in or token is refreshed
              if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                try {
                  // Initialize user profile service
                  userProfileService.initialize(currentUser.id);

                  // Create user profile if it doesn't exist
                  const profile = await userProfileService.getUserProfile();
                  if (!profile) {
                    logService.log('info', 'Creating new user profile', { userId: currentUser.id }, 'AuthProvider');
                    await userProfileService.saveUserProfile({
                      email: currentUser.email,
                      auto_reconnect: true
                    });
                  }

                  // Initialize exchange service
                  await exchangeService.initialize();
                } catch (profileError) {
                  logService.log('error', 'Failed to initialize user profile', profileError, 'AuthProvider');

                  // Try to refresh the session if we get an auth error
                  if (profileError.message?.includes('API key') ||
                      profileError.message?.includes('Unauthorized') ||
                      profileError.message?.includes('JWT')) {
                    logService.log('info', 'Attempting to refresh session after auth error', null, 'AuthProvider');
                    await refreshSession();
                  }
                }
              }
            } else if (event === 'SIGNED_OUT') {
              // Clear cached user on sign out
              localStorage.removeItem('sb-user');
              localStorage.removeItem('sb-auth-token');
              setUser(null);
              logService.log('info', 'User signed out', null, 'AuthProvider');
            }

            setLoading(false);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('useAuth: Auth initialization failed:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        if (mounted) {
          console.log('useAuth: Setting error state:', error);
          setError(error as AuthError);
        }
        logService.error('Failed to initialize auth', error, 'AuthContext');
        console.log('useAuth: Supabase client state:', supabase);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev);
  };

  const signIn = async (email: string, password: string) => {
    try {
      logService.log('info', 'Attempting to sign in with Supabase', { email }, 'AuthProvider');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        logService.log('error', 'Sign in error', error, 'AuthProvider');
        throw error;
      }

      logService.log('info', 'Sign in successful', { userId: data.user.id }, 'AuthProvider');

      // Store the session token in localStorage
      if (data.session) {
        // The token is already stored by Supabase, but we'll ensure it's properly set
        localStorage.setItem('sb-auth-token', JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }));
      }

      // Refresh news data on login
      try {
        logService.log('info', 'Refreshing news data on login', null, 'AuthProvider');
        const { globalCacheService } = await import('../lib/global-cache-service');
        await globalCacheService.forceRefreshNews();
        logService.log('info', 'News data refreshed successfully on login', null, 'AuthProvider');
      } catch (newsError) {
        logService.log('warn', 'Failed to refresh news data on login', newsError, 'AuthProvider');
        // Continue with login process even if news refresh fails
      }

      // Explicitly update the user state
      setUser(data.user);

      // Cache the user in localStorage
      localStorage.setItem('sb-user', JSON.stringify(data.user));

      // Initialize user profile service when user logs in
      try {
        // Initialize user profile service
        await userProfileService.initialize(data.user.id);

        // Create user profile if it doesn't exist
        const profile = await userProfileService.getUserProfile();
        if (!profile) {
          logService.log('info', 'Creating new user profile', { userId: data.user.id }, 'AuthProvider');
          await userProfileService.saveUserProfile({
            email: data.user.email,
            auto_reconnect: true
          });
        }

        // Initialize exchange service
        await exchangeService.initialize();
      } catch (profileError) {
        logService.log('error', 'Failed to initialize user profile', profileError, 'AuthProvider');

        // Try to refresh the session if we get an auth error
        if (profileError.message?.includes('API key') ||
            profileError.message?.includes('Unauthorized') ||
            profileError.message?.includes('JWT')) {
          logService.log('info', 'Attempting to refresh session after auth error', null, 'AuthProvider');
          await refreshSession();
        }
      }

      toast.success('Successfully signed in!');
    } catch (error) {
      logService.log('error', 'Error in signIn method', error, 'AuthProvider');
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      toast.success('Please check your email to verify your account!');
    } catch (error) {
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('useAuth: Signing out user');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Explicitly set user to null to ensure UI updates immediately
      setUser(null);

      // Clear all cached auth data
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-user');
      localStorage.removeItem('activeExchange');
      localStorage.removeItem('defaultExchange');

      // Clear session storage as well
      sessionStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('sb-auth-token');

      console.log('useAuth: User signed out successfully');
      toast.success('Successfully signed out!');
    } catch (error) {
      console.error('useAuth: Error during sign out:', error);
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);

      // Still try to clear user state and storage
      setUser(null);
      localStorage.removeItem('sb-user');
      localStorage.removeItem('activeExchange');
      localStorage.removeItem('defaultExchange');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset instructions sent to your email!');
    } catch (error) {
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
      throw error;
    }
  };

  const signInWithGithub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
      throw error;
    }
  };

  const signInWithDiscord = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    error,
    isDemoMode,
    signIn,
    signUp,
    signOut,
    resetPassword,
    toggleDemoMode,
    signInWithGithub,
    signInWithDiscord
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
