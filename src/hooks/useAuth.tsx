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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('useAuth: Initial session check:', { session, error: sessionError });

        if (sessionError) {
          console.error('useAuth: Session error:', sessionError);
          throw sessionError;
        }

        if (mounted) {
          console.log('useAuth: Setting initial user state:', session?.user);
          setUser(session?.user ?? null);
        }

        console.log('useAuth: Setting up auth state change listener');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('useAuth: Auth state changed:', { event, user: session?.user });
          if (mounted) {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            console.log('useAuth: User state updated after auth change:', currentUser);

            // Initialize user profile service when user logs in
            if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Successfully signed out!');
    } catch (error) {
      const authError = error as AuthError;
      setError(authError);
      toast.error(authError.message);
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
