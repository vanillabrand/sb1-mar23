import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, type AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
              const { data, error } = await supabase.auth.refreshSession();
              if (error) {
                console.error('useAuth: Failed to refresh session:', error);
                // Clear cached user if refresh fails
                localStorage.removeItem('sb-user');
                setUser(null);
              } else if (data.session) {
                console.log('useAuth: Session refreshed successfully:', data.session);
                setUser(data.session.user);

                // Initialize user profile service
                userProfileService.initialize(data.session.user.id);

                // Initialize exchange service
                await exchangeService.initialize();
              }
            } catch (refreshError) {
              console.error('useAuth: Error refreshing session:', refreshError);
              localStorage.removeItem('sb-user');
              setUser(null);
            }
          }
        }

        console.log('useAuth: Setting up auth state change listener');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('useAuth: Auth state changed:', { event, user: session?.user });
          if (mounted) {
            const currentUser = session?.user ?? null;

            if (currentUser) {
              setUser(currentUser);
              // Cache the user in localStorage
              localStorage.setItem('sb-user', JSON.stringify(currentUser));
              console.log('useAuth: User state updated after auth change:', currentUser);

              // Initialize user profile service when user logs in
              if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                try {
                  // Initialize user profile service
                  userProfileService.initialize(currentUser.id);

                  // Create user profile if it doesn't exist
                  const profile = await userProfileService.getUserProfile();
                  if (!profile) {
                    await userProfileService.saveUserProfile({
                      email: currentUser.email,
                      auto_reconnect: true
                    });
                  }

                  // Initialize exchange service
                  await exchangeService.initialize();
                } catch (profileError) {
                  console.error('Failed to initialize user profile:', profileError);
                  logService.error('Failed to initialize user profile', profileError, 'AuthProvider');
                }
              }
            } else if (event === 'SIGNED_OUT') {
              // Clear cached user on sign out
              localStorage.removeItem('sb-user');
              setUser(null);
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
      console.log('useAuth: Attempting to sign in with Supabase');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('useAuth: Sign in response:', { data, error });

      if (error) {
        console.error('useAuth: Sign in error:', error);
        throw error;
      }

      console.log('useAuth: Sign in successful, user:', data.user);

      // Explicitly update the user state
      setUser(data.user);

      // Initialize user profile service when user logs in
      try {
        // Initialize user profile service
        await userProfileService.initialize(data.user.id);

        // Create user profile if it doesn't exist
        const profile = await userProfileService.getUserProfile();
        if (!profile) {
          await userProfileService.saveUserProfile({
            email: data.user.email,
            auto_reconnect: true
          });
        }

        // Initialize exchange service
        await exchangeService.initialize();
      } catch (profileError) {
        console.error('Failed to initialize user profile:', profileError);
        logService.error('Failed to initialize user profile', profileError, 'AuthContext');
      }

      toast.success('Successfully signed in!');
    } catch (error) {
      console.error('useAuth: Error in signIn method:', error);
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
