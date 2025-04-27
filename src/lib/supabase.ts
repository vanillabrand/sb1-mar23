import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';
import { config } from './config';
import { logService } from './log-service';

// Use environment variables or config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || config.supabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || config.supabaseAnonKey;

logService.log('info', 'Supabase initialization', {
  supabaseUrl,
  anonKeyLength: supabaseAnonKey?.length || 0,
  envVars: {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
    configUrl: config.supabaseUrl ? 'defined' : 'undefined',
    configKey: config.supabaseAnonKey ? 'defined' : 'undefined'
  }
}, 'SupabaseClient');

if (!supabaseUrl || !supabaseAnonKey) {
  const error = 'Missing Supabase environment variables';
  logService.log('error', error, null, 'SupabaseClient');
  throw new Error(error);
}

// Create a single Supabase client instance for the entire application
logService.log('info', 'Creating Supabase client', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length,
}, 'SupabaseClient');

// Helper function to get auth token from localStorage
const getAuthToken = () => {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      logService.log('warn', 'localStorage not available, cannot get auth token', null, 'SupabaseClient');
      return null;
    }

    const storageKey = 'sb-auth-token';
    const tokenString = localStorage.getItem(storageKey);
    if (tokenString) {
      const tokenData = JSON.parse(tokenString);
      return tokenData?.access_token || null;
    }
    return null;
  } catch (error) {
    logService.log('error', 'Failed to get auth token from localStorage', error, 'SupabaseClient');
    return null;
  }
};

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sb-auth-token',
      storage: localStorage
    },
    global: {
      headers: {
        'Accept': '*/*',  // Use wildcard Accept header to fix 406 errors
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'X-Client-Info': 'supabase-js/2.x',
        'Prefer': 'return=representation'  // Always return representation
      },
      fetch: (url, options) => {
        // Get the current auth token
        const authToken = getAuthToken();

        // Add custom fetch handler to ensure proper headers
        const customOptions = {
          ...options,
          headers: {
            ...options?.headers,
            'Accept': 'application/json, */*',  // Ensure Accept header is set correctly for JSON
            'Content-Type': 'application/json', // Always set Content-Type to application/json
            'apikey': supabaseAnonKey, // Always include the API key
          }
        };

        // Add Authorization header if we have a token
        if (authToken) {
          customOptions.headers = {
            ...customOptions.headers,
            'Authorization': `Bearer ${authToken}`
          };
        }

        // Log the request for debugging (only in development)
        if (import.meta.env.DEV) {
          logService.log('debug', `Supabase request: ${url}`, {
            hasAuthToken: !!authToken,
            method: options?.method || 'GET',
            headers: Object.keys(customOptions.headers || {})
          }, 'SupabaseClient');
        }

        // Add error handling for the fetch request
        return fetch(url, customOptions)
          .then(response => {
            // Check if the response is ok
            if (!response.ok) {
              // Log the error details
              logService.log('error', `Supabase request failed: ${response.status} ${response.statusText}`, {
                url,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type')
              }, 'SupabaseClient');
            }
            return response;
          })
          .catch(error => {
            // Log network errors
            logService.log('error', `Supabase network error`, {
              url,
              error: error.message
            }, 'SupabaseClient');
            throw error;
          });
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

logService.log('info', 'Supabase client created', null, 'SupabaseClient');

// Utility function to get the current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      logService.log('error', 'Failed to get current session', error, 'SupabaseClient');
      throw error;
    }
    return session;
  } catch (error) {
    logService.log('error', 'Exception getting current session', error, 'SupabaseClient');
    throw error;
  }
};

// Utility function to get the current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      logService.log('error', 'Failed to get current user', error, 'SupabaseClient');
      throw error;
    }
    return user;
  } catch (error) {
    logService.log('error', 'Exception getting current user', error, 'SupabaseClient');
    throw error;
  }
};

// Utility function to refresh the session
export const refreshSession = async () => {
  try {
    logService.log('info', 'Attempting to refresh session', null, 'SupabaseClient');

    // First, try to get the current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      logService.log('warn', 'Failed to get current session before refresh', sessionError, 'SupabaseClient');
    } else {
      logService.log('info', 'Current session status', {
        hasSession: !!sessionData.session,
        expiresAt: sessionData.session?.expires_at
      }, 'SupabaseClient');
    }

    // Attempt to refresh the session
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      logService.log('error', 'Failed to refresh session', error, 'SupabaseClient');

      // If we have a session in localStorage, try to use it
      try {
        const tokenString = localStorage.getItem('sb-auth-token');
        if (tokenString) {
          const tokenData = JSON.parse(tokenString);
          if (tokenData?.access_token) {
            logService.log('info', 'Found token in localStorage, attempting to set session manually', null, 'SupabaseClient');

            // Set the session manually
            const { data: setData, error: setError } = await supabase.auth.setSession({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || ''
            });

            if (setError) {
              logService.log('error', 'Failed to set session manually', setError, 'SupabaseClient');
              return false;
            }

            logService.log('info', 'Session set manually from localStorage', null, 'SupabaseClient');
            return true;
          }
        }
      } catch (localStorageError) {
        logService.log('error', 'Error accessing localStorage for session recovery', localStorageError, 'SupabaseClient');
      }

      return false;
    }

    // Store the refreshed token in localStorage if available
    if (data.session) {
      try {
        // Check if localStorage is available
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sb-auth-token', JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at
          }));
          logService.log('info', 'Refreshed token stored in localStorage', null, 'SupabaseClient');
        } else {
          logService.log('warn', 'localStorage not available, cannot store refreshed token', null, 'SupabaseClient');
        }
      } catch (storageError) {
        logService.log('warn', 'Failed to store refreshed token in localStorage', storageError, 'SupabaseClient');
      }
    }

    logService.log('info', 'Session refreshed successfully', null, 'SupabaseClient');
    return true;
  } catch (error) {
    logService.log('error', 'Exception refreshing session', error, 'SupabaseClient');
    return false;
  }
};

export { type Database } from './supabase-types';
