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
    this.userId = userId;
  }

  /**
   * Get the user's profile
   * @returns The user's profile or null if not found
   */
  async getUserProfile(): Promise<any | null> {
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
    if (!this.userId) {
      logService.log('warn', 'Cannot save active exchange: No user ID', null, 'UserProfileService');
      return false;
    }

    try {
      const connectionStatus = exchange ? 'connected' : 'disconnected';
      const connectionError = null; // Reset error when saving a new connection

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
    if (!this.userId) {
      logService.log('warn', 'Cannot get active exchange: No user ID', null, 'UserProfileService');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('active_exchange')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;
      return data?.active_exchange || null;
    } catch (error) {
      logService.log('error', 'Failed to get active exchange', error, 'UserProfileService');
      return null;
    }
  }

  /**
   * Update the connection status in the user's profile
   * @param status The connection status
   * @param error Optional error message
   * @returns True if successful, false otherwise
   */
  async updateConnectionStatus(status: 'connected' | 'disconnected' | 'error', error?: string): Promise<boolean> {
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
    if (!this.userId) {
      logService.log('warn', 'Cannot set auto-reconnect: No user ID', null, 'UserProfileService');
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
    if (!this.userId) {
      logService.log('warn', 'Cannot get auto-reconnect: No user ID', null, 'UserProfileService');
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

  /**
   * Set the default exchange for the user
   * @param exchangeId The ID of the exchange to set as default
   * @returns True if successful, false otherwise
   */
  async setDefaultExchange(exchangeId: string): Promise<boolean> {
    if (!this.userId) {
      logService.log('warn', 'Cannot set default exchange: No user ID', null, 'UserProfileService');
      return false;
    }

    try {
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
      logService.log('info', `Set default exchange to ${exchangeId}`, null, 'UserProfileService');
      return true;
    } catch (error) {
      logService.log('error', 'Failed to set default exchange', error, 'UserProfileService');
      return false;
    }
  }

  /**
   * Get the default exchange ID for the user
   * @returns The default exchange ID or null if not set
   */
  async getDefaultExchange(): Promise<string | null> {
    if (!this.userId) {
      logService.log('warn', 'Cannot get default exchange: No user ID', null, 'UserProfileService');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('default_exchange_id')
        .eq('user_id', this.userId)
        .single();

      if (error) throw error;
      return data?.default_exchange_id || null;
    } catch (error) {
      logService.log('error', 'Failed to get default exchange', error, 'UserProfileService');
      return null;
    }
  }
}

export const userProfileService = UserProfileService.getInstance();
