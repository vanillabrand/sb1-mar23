import { supabase } from './supabase';
import { logService } from './log-service';
import type { Exchange } from './types';

/**
 * Service for managing user profiles
 */
class UserProfileService {
  private static instance: UserProfileService;
  private userId: string | null = null;

  private constructor() {}

  static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  /**
   * Initialize the user profile service with the current user ID
   * @param userId The current user ID
   */
  initialize(userId: string): void {
    if (!userId) {
      logService.log('warn', 'Cannot initialize user profile service: No user ID provided', null, 'UserProfileService');
      return;
    }

    this.userId = userId;
    logService.log('info', `Initialized user profile service with user ID: ${userId}`, null, 'UserProfileService');

    // Store user ID in localStorage for persistence
    try {
      localStorage.setItem('userProfileUserId', userId);
    } catch (error) {
      logService.log('warn', 'Failed to store user ID in localStorage', error, 'UserProfileService');
    }
  }

  /**
   * Try to recover the user ID from localStorage if it's not set
   * @returns The recovered user ID or null if not found
   */
  private recoverUserId(): string | null {
    if (this.userId) return this.userId;

    try {
      const storedUserId = localStorage.getItem('userProfileUserId');
      if (storedUserId) {
        this.userId = storedUserId;
        logService.log('info', `Recovered user ID from localStorage: ${storedUserId}`, null, 'UserProfileService');
        return storedUserId;
      }

      // Also try to get from the sb-user item
      const cachedUserStr = localStorage.getItem('sb-user');
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr);
          if (cachedUser && cachedUser.id) {
            this.userId = cachedUser.id;
            logService.log('info', `Recovered user ID from sb-user: ${cachedUser.id}`, null, 'UserProfileService');
            return cachedUser.id;
          }
        } catch (e) {
          logService.log('warn', 'Failed to parse cached user', e, 'UserProfileService');
        }
      }
    } catch (error) {
      logService.log('warn', 'Failed to recover user ID from localStorage', error, 'UserProfileService');
    }

    return null;
  }

  /**
   * Get the user's profile
   * @returns The user's profile or null if not found
   */
  async getUserProfile(): Promise<any | null> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot get user profile: No user ID', null, 'UserProfileService');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logService.log('error', 'Failed to get user profile', error, 'UserProfileService');
      return null;
    }
  }

  /**
   * Create or update the user's profile
   * @param profile The profile data to save
   * @returns The updated profile or null if failed
   */
  async saveUserProfile(profile: any): Promise<any | null> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot save user profile: No user ID', null, 'UserProfileService');
      return null;
    }

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', this.userId)
        .single();

      let result;

      if (existingProfile) {
        // Update existing profile
        const { data, error } = await supabase
          .from('user_profiles')
          .update({
            ...profile,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', this.userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('user_profiles')
          .insert({
            user_id: this.userId,
            ...profile,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return result;
    } catch (error) {
      logService.log('error', 'Failed to save user profile', error, 'UserProfileService');
      return null;
    }
  }

  /**
   * Save the active exchange to the user's profile
   * @param exchange The active exchange
   * @returns True if successful, false otherwise
   */
  async saveActiveExchange(exchange: Exchange | null): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot save active exchange: No user ID', null, 'UserProfileService');
      return false;
    }

    try {
      const connectionStatus = exchange ? 'connected' : 'disconnected';
      const connectionError = null; // Reset error when saving a new connection

      // Store the exchange ID in localStorage for cross-session persistence
      if (exchange) {
        try {
          localStorage.setItem('activeExchange', JSON.stringify({
            id: exchange.id,
            name: exchange.name || exchange.id,
            timestamp: Date.now()
          }));
          logService.log('info', `Saved active exchange to localStorage: ${exchange.id}`, null, 'UserProfileService');
        } catch (localStorageError) {
          logService.log('warn', 'Failed to save active exchange to localStorage', localStorageError, 'UserProfileService');
        }
      } else {
        localStorage.removeItem('activeExchange');
      }

      // Also set this exchange as the default if it's not null
      if (exchange) {
        await this.setDefaultExchange(exchange.id);
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          active_exchange: exchange,
          last_connection_status: connectionStatus,
          connection_error: connectionError,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      logService.log('info', exchange
        ? `Saved active exchange to profile: ${exchange.id}`
        : 'Cleared active exchange from profile', null, 'UserProfileService');

      return true;
    } catch (error) {
      logService.log('error', 'Failed to save active exchange', error, 'UserProfileService');
      return false;
    }
  }

  /**
   * Get the active exchange from the user's profile
   * @returns The active exchange or null if not found
   */
  async getActiveExchange(): Promise<Exchange | null> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot get active exchange: No user ID', null, 'UserProfileService');

      // Even without a user ID, try to get from localStorage as a fallback
      try {
        const activeExchangeStr = localStorage.getItem('activeExchange');
        if (activeExchangeStr) {
          const activeExchangeInfo = JSON.parse(activeExchangeStr);
          if (activeExchangeInfo && activeExchangeInfo.id) {
            logService.log('info', `Found active exchange in localStorage without user ID: ${activeExchangeInfo.id}`, null, 'UserProfileService');

            // Create a minimal exchange object
            return {
              id: activeExchangeInfo.id,
              name: activeExchangeInfo.name || activeExchangeInfo.id,
              type: 'unknown',
              credentials: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
          }
        }
      } catch (localStorageError) {
        logService.log('warn', 'Failed to get active exchange from localStorage without user ID', localStorageError, 'UserProfileService');
      }

      return null;
    }

    try {
      // First try to get from database
      const { data, error } = await supabase
        .from('user_profiles')
        .select('active_exchange')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        logService.log('warn', 'Failed to get active exchange from database', error, 'UserProfileService');
      } else if (data?.active_exchange) {
        logService.log('info', `Retrieved active exchange from database: ${data.active_exchange.id}`, null, 'UserProfileService');
        return data.active_exchange;
      }

      // If not found in database, try localStorage
      try {
        const activeExchangeStr = localStorage.getItem('activeExchange');
        if (activeExchangeStr) {
          const activeExchangeInfo = JSON.parse(activeExchangeStr);

          if (activeExchangeInfo && activeExchangeInfo.id) {
            logService.log('info', `Found active exchange in localStorage: ${activeExchangeInfo.id}`, null, 'UserProfileService');

            // Get the full exchange details from the database
            const { data: exchangeData, error: exchangeError } = await supabase
              .from('user_exchanges')
              .select('*')
              .eq('user_id', this.userId)
              .eq('name', activeExchangeInfo.id)
              .single();

            if (!exchangeError && exchangeData) {
              logService.log('info', `Retrieved exchange details for ${activeExchangeInfo.id}`, null, 'UserProfileService');

              // Save this exchange as the active exchange in the database for future use
              await this.saveActiveExchange(exchangeData);

              return exchangeData;
            } else {
              logService.log('warn', `Exchange ${activeExchangeInfo.id} from localStorage not found in database`, exchangeError, 'UserProfileService');
            }
          }
        }
      } catch (localStorageError) {
        logService.log('warn', 'Failed to get active exchange from localStorage', localStorageError, 'UserProfileService');
      }

      // If still not found, try to get the default exchange
      const defaultExchangeId = await this.getDefaultExchange();
      if (defaultExchangeId) {
        logService.log('info', `Trying default exchange: ${defaultExchangeId}`, null, 'UserProfileService');

        const { data: defaultExchange, error: defaultError } = await supabase
          .from('user_exchanges')
          .select('*')
          .eq('user_id', this.userId)
          .eq('name', defaultExchangeId)
          .single();

        if (!defaultError && defaultExchange) {
          logService.log('info', `Using default exchange: ${defaultExchangeId}`, null, 'UserProfileService');

          // Save this as the active exchange
          await this.saveActiveExchange(defaultExchange);

          return defaultExchange;
        }
      }

      // If all else fails, return null
      return null;
    } catch (error) {
      logService.log('error', 'Failed to get active exchange', error, 'UserProfileService');
      return null;
    }
  }

  /**
   * Get the default exchange ID from the user's profile
   * @returns The default exchange ID or null if not found
   */
  async getDefaultExchange(): Promise<string | null> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot get default exchange: No user ID', null, 'UserProfileService');

      // Even without a user ID, try to get from localStorage as a fallback
      try {
        const defaultExchangeId = localStorage.getItem('defaultExchange');
        if (defaultExchangeId) {
          logService.log('info', `Found default exchange in localStorage without user ID: ${defaultExchangeId}`, null, 'UserProfileService');
          return defaultExchangeId;
        }
      } catch (localStorageError) {
        logService.log('warn', 'Failed to get default exchange from localStorage without user ID', localStorageError, 'UserProfileService');
      }

      return null;
    }

    try {
      // First try to get from database
      const { data, error } = await supabase
        .from('user_profiles')
        .select('default_exchange_id')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        logService.log('warn', 'Failed to get default exchange from database', error, 'UserProfileService');
      } else if (data?.default_exchange_id) {
        logService.log('info', `Retrieved default exchange from database: ${data.default_exchange_id}`, null, 'UserProfileService');
        return data.default_exchange_id;
      }

      // If not found in database, try localStorage
      try {
        const defaultExchangeId = localStorage.getItem('defaultExchange');
        if (defaultExchangeId) {
          logService.log('info', `Found default exchange in localStorage: ${defaultExchangeId}`, null, 'UserProfileService');

          // Save this as the default exchange in the database for future use
          await this.setDefaultExchange(defaultExchangeId);

          return defaultExchangeId;
        }
      } catch (localStorageError) {
        logService.log('warn', 'Failed to get default exchange from localStorage', localStorageError, 'UserProfileService');
      }

      // If still not found, try to get the first exchange with is_default=true
      const { data: defaultExchange, error: defaultError } = await supabase
        .from('user_exchanges')
        .select('name')
        .eq('user_id', this.userId)
        .eq('is_default', true)
        .single();

      if (!defaultError && defaultExchange) {
        logService.log('info', `Found default exchange from user_exchanges: ${defaultExchange.name}`, null, 'UserProfileService');

        // Save this as the default exchange in the database for future use
        await this.setDefaultExchange(defaultExchange.name);

        return defaultExchange.name;
      }

      // If all else fails, return null
      return null;
    } catch (error) {
      logService.log('error', 'Failed to get default exchange', error, 'UserProfileService');
      return null;
    }
  }

  /**
   * Set the default exchange ID in the user's profile
   * @param exchangeId The exchange ID to set as default
   * @returns True if successful, false otherwise
   */
  async setDefaultExchange(exchangeId: string): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot set default exchange: No user ID', null, 'UserProfileService');

      // Even without a user ID, try to save to localStorage
      try {
        localStorage.setItem('defaultExchange', exchangeId);
        logService.log('info', `Saved default exchange to localStorage without user ID: ${exchangeId}`, null, 'UserProfileService');
        return true;
      } catch (localStorageError) {
        logService.log('warn', 'Failed to save default exchange to localStorage without user ID', localStorageError, 'UserProfileService');
      }

      return false;
    }

    try {
      // Save to database
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          default_exchange_id: exchangeId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Also save to localStorage
      localStorage.setItem('defaultExchange', exchangeId);

      // Update the is_default flag in the user_exchanges table
      try {
        // First, set is_default=false for all exchanges
        await supabase
          .from('user_exchanges')
          .update({ is_default: false })
          .eq('user_id', this.userId);

        // Then set is_default=true for the selected exchange
        await supabase
          .from('user_exchanges')
          .update({ is_default: true })
          .eq('user_id', this.userId)
          .eq('name', exchangeId);

        logService.log('info', `Set ${exchangeId} as default exchange`, null, 'UserProfileService');
      } catch (exchangeError) {
        logService.log('warn', 'Failed to update is_default flag in user_exchanges', exchangeError, 'UserProfileService');
        // Don't fail the operation if this part fails
      }

      return true;
    } catch (error) {
      logService.log('error', 'Failed to set default exchange', error, 'UserProfileService');
      return false;
    }
  }

  /**
   * Update the connection status in the user's profile
   * @param status The connection status
   * @param error Optional error message
   * @returns True if successful, false otherwise
   */
  async updateConnectionStatus(status: 'connected' | 'disconnected' | 'error', error?: string): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot update connection status: No user ID', null, 'UserProfileService');
      return false;
    }

    try {
      const { error: dbError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          last_connection_status: status,
          connection_error: error || null,
          connection_attempts: status === 'error' ? supabase.rpc('increment_connection_attempts', { user_id_param: this.userId }) : 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (dbError) throw dbError;
      return true;
    } catch (error) {
      logService.log('error', 'Failed to update connection status', error, 'UserProfileService');
      return false;
    }
  }

  /**
   * Set the auto-reconnect preference
   * @param autoReconnect Whether to auto-reconnect
   * @returns True if successful, false otherwise
   */
  async setAutoReconnect(autoReconnect: boolean): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot set auto-reconnect: No user ID', null, 'UserProfileService');

      // Even without a user ID, try to save to localStorage
      try {
        localStorage.setItem('autoReconnect', String(autoReconnect));
        logService.log('info', `Saved auto-reconnect to localStorage without user ID: ${autoReconnect}`, null, 'UserProfileService');
        return true;
      } catch (localStorageError) {
        logService.log('warn', 'Failed to save auto-reconnect to localStorage without user ID', localStorageError, 'UserProfileService');
      }

      return false;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          auto_reconnect: autoReconnect,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      logService.log('error', 'Failed to set auto-reconnect', error, 'UserProfileService');
      return false;
    }
  }

  /**
   * Get the auto-reconnect preference
   * @returns Whether auto-reconnect is enabled
   */
  async getAutoReconnect(): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot get auto-reconnect: No user ID', null, 'UserProfileService');

      // Even without a user ID, try to get from localStorage
      try {
        const autoReconnectStr = localStorage.getItem('autoReconnect');
        if (autoReconnectStr !== null) {
          const autoReconnect = autoReconnectStr === 'true';
          logService.log('info', `Found auto-reconnect in localStorage without user ID: ${autoReconnect}`, null, 'UserProfileService');
          return autoReconnect;
        }
      } catch (localStorageError) {
        logService.log('warn', 'Failed to get auto-reconnect from localStorage without user ID', localStorageError, 'UserProfileService');
      }

      return true; // Default to true
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('auto_reconnect')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;
      // If no profile or no preference, default to true
      return data?.auto_reconnect !== false;
    } catch (error) {
      logService.log('error', 'Failed to get auto-reconnect', error, 'UserProfileService');
      return true; // Default to true
    }
  }

  /**
   * Reset the connection attempts counter
   * @returns True if successful, false otherwise
   */
  async resetConnectionAttempts(): Promise<boolean> {
    // Try to recover user ID if not set
    if (!this.userId) {
      this.recoverUserId();
    }

    if (!this.userId) {
      logService.log('warn', 'Cannot reset connection attempts: No user ID', null, 'UserProfileService');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          connection_attempts: 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      logService.log('error', 'Failed to reset connection attempts', error, 'UserProfileService');
      return false;
    }
  }
}

export const userProfileService = UserProfileService.getInstance();
