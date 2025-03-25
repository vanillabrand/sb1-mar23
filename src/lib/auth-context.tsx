import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logService } from './log-service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isDemoMode: false,
  setDemoMode: () => {}
});

// Check if demo mode is enabled in local storage
const getDemoModeFromStorage = (): boolean => {
  try {
    return localStorage.getItem('demoMode') === 'true';
  } catch (e) {
    return false;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(getDemoModeFromStorage());
  const [authError, setAuthError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // If demo mode is enabled, create a fake user
    if (isDemoMode) {
      if (mounted) {
        setUser({
          id: 'demo-user-id',
          app_metadata: {},
          user_metadata: { name: 'Demo User' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          email: 'demo@stratgen.ai'
        } as User);
        setLoading(false);
      }
      logService.log('info', 'Running in demo mode with simulated authentication', null, 'AuthContext');
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logService.log('error', 'Error getting initial auth session:', error, 'AuthContext');
          setAuthError(error);
        } else if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        logService.log('error', 'Unexpected error during auth initialization:', error, 'AuthContext');
        setAuthError(error instanceof Error ? error : new Error('Auth initialization failed'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          logService.log('info', 'User signed in successfully', null, 'AuthContext');
        } else if (event === 'SIGNED_OUT') {
          logService.log('info', 'User signed out', null, 'AuthContext');
        }
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  // Save demo mode to local storage
  useEffect(() => {
    try {
      localStorage.setItem('demoMode', String(isDemoMode));
    } catch (e) {
      // Ignore storage errors
    }
  }, [isDemoMode]);

  const handleSetDemoMode = (value: boolean) => {
    if (value && !isDemoMode) {
      // Switching to demo mode
      setIsDemoMode(true);
    } else if (!value && isDemoMode) {
      // Switching from demo mode
      setIsDemoMode(false);
      setUser(null);
    }
  };

  const signOut = async () => {
    try {
      if (isDemoMode) {
        // Just clear demo mode
        setIsDemoMode(false);
        setUser(null);
      } else {
        // Real sign out
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } catch (error) {
      logService.log('error', 'Error signing out:', error, 'AuthContext');
      throw error;
    }
  };

  // If there's an auth error, log it but don't throw - let the app continue in a degraded state
  if (authError) {
    logService.log('warn', 'Auth error occurred, continuing in degraded state:', authError, 'AuthContext');
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut,
      isDemoMode,
      setDemoMode: handleSetDemoMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}