import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { logService } from './log-service';
import { supabase } from './supabase-client';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        setUser(session?.user ?? null);

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            setUser(session?.user ?? null);
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Auth initialization failed:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        logService.error('Failed to initialize auth', error, 'AuthContext');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value = {
    user,
    loading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
