import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logService } from './log-service';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signOut: async () => {},
  isDemoMode: false,
  setDemoMode: () => {},
  refreshSession: async () => {},
});

const getDemoModeFromStorage = (): boolean => {
  try {
    return localStorage.getItem('demoMode') === 'true';
  } catch (e) {
    logService.log('error', 'Failed to read demo mode from storage', e, 'AuthContext');
    return false;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });
  const [isDemoMode, setIsDemoMode] = useState<boolean>(getDemoModeFromStorage());

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        error: null,
      }));
    } catch (error) {
      logService.log('error', 'Failed to refresh session', error, 'AuthContext');
      setState(prev => ({ ...prev, error: error as Error }));
    }
  };

  useEffect(() => {
    let mounted = true;

    if (isDemoMode) {
      if (mounted) {
        setState({
          user: {
            id: 'demo-user-id',
            app_metadata: {},
            user_metadata: { name: 'Demo User' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            role: 'authenticated',
            updated_at: new Date().toISOString(),
            email: 'demo@stratgen.ai'
          } as User,
          session: null,
          loading: false,
          error: null,
        });
      }
      logService.log('info', 'Running in demo mode with simulated authentication', null, 'AuthContext');
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setState({
            session,
            user: session?.user ?? null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        logService.log('error', 'Auth initialization failed', error, 'AuthContext');
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error as Error,
          }));
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setState(prev => ({
            ...prev,
            session,
            user: session?.user ?? null,
            loading: false,
          }));

          if (event === 'SIGNED_IN') {
            logService.log('info', 'User signed in successfully', null, 'AuthContext');
          } else if (event === 'SIGNED_OUT') {
            logService.log('info', 'User signed out', null, 'AuthContext');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  useEffect(() => {
    try {
      localStorage.setItem('demoMode', String(isDemoMode));
    } catch (e) {
      logService.log('error', 'Failed to save demo mode to storage', e, 'AuthContext');
    }
  }, [isDemoMode]);

  const handleSetDemoMode = (value: boolean) => {
    if (value === isDemoMode) return;
    
    if (value) {
      setIsDemoMode(true);
    } else {
      setIsDemoMode(false);
      setState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    }
  };

  const signOut = async () => {
    try {
      if (isDemoMode) {
        handleSetDemoMode(false);
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } catch (error) {
      logService.log('error', 'Sign out failed', error, 'AuthContext');
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      ...state,
      signOut,
      isDemoMode,
      setDemoMode: handleSetDemoMode,
      refreshSession,
    }),
    [state, isDemoMode]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
