import { supabase } from './enhanced-supabase';
import { logService } from './log-service';
import { EventEmitter } from './event-emitter';

// Define experience mode types
export type ExperienceMode = 'beginner' | 'intermediate' | 'expert';

// Define preferences for each mode
export interface BeginnerPreferences {
  showTooltips: boolean;
  showGuidedHelp: boolean;
  simplifiedUI: boolean;
  educationalContentLevel: 'basic' | 'intermediate' | 'advanced';
}

export interface IntermediatePreferences {
  showTooltips: boolean;
  showGuidedHelp: boolean;
  simplifiedUI: boolean;
  dashboardLayout: 'standard' | 'compact';
  showAdvancedMetrics: boolean;
}

export interface ExpertPreferences {
  showTooltips: boolean;
  showGuidedHelp: boolean;
  simplifiedUI: boolean;
  dashboardLayout: 'standard' | 'advanced' | 'custom';
  showAdvancedMetrics: boolean;
  showAPIOptions: boolean;
  enableExperimentalFeatures: boolean;
}

// Define user experience mode interface
export interface UserExperienceMode {
  id: string;
  user_id: string;
  experience_mode: ExperienceMode;
  onboarding_completed: boolean;
  beginner_tutorial_completed: boolean;
  last_mode_change: string;
  created_at: string;
  updated_at: string;
  beginner_preferences: BeginnerPreferences;
  intermediate_preferences: IntermediatePreferences;
  expert_preferences: ExpertPreferences;
}

// Default preferences
const DEFAULT_BEGINNER_PREFERENCES: BeginnerPreferences = {
  showTooltips: true,
  showGuidedHelp: true,
  simplifiedUI: true,
  educationalContentLevel: 'basic'
};

const DEFAULT_INTERMEDIATE_PREFERENCES: IntermediatePreferences = {
  showTooltips: true,
  showGuidedHelp: false,
  simplifiedUI: false,
  dashboardLayout: 'standard',
  showAdvancedMetrics: false
};

const DEFAULT_EXPERT_PREFERENCES: ExpertPreferences = {
  showTooltips: false,
  showGuidedHelp: false,
  simplifiedUI: false,
  dashboardLayout: 'advanced',
  showAdvancedMetrics: true,
  showAPIOptions: true,
  enableExperimentalFeatures: false
};

/**
 * Service to manage user experience modes
 */
class ExperienceModeService extends EventEmitter {
  private userId: string | null = null;
  private currentMode: ExperienceMode = 'intermediate';
  private userExperienceMode: UserExperienceMode | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the experience mode service
   * @param userId The user ID
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.userId === userId) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize(userId);
    
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Internal initialization method
   * @param userId The user ID
   */
  private async _initialize(userId: string): Promise<void> {
    try {
      this.userId = userId;
      
      // Fetch user experience mode from database
      const { data, error } = await supabase
        .from('user_experience_modes')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // If no record exists, create one
        if (error.code === 'PGRST116') {
          await this.createDefaultExperienceMode(userId);
        } else {
          throw error;
        }
      } else if (data) {
        this.userExperienceMode = data as UserExperienceMode;
        this.currentMode = data.experience_mode;
      }
      
      this.isInitialized = true;
      this.emit('initialized', { userId, mode: this.currentMode });
      
      // Set up real-time subscription for changes
      this.setupRealtimeSubscription();
      
    } catch (error) {
      logService.log('error', 'Failed to initialize experience mode service', error, 'ExperienceModeService');
      // Fall back to default mode
      this.currentMode = 'intermediate';
      this.isInitialized = true;
    }
  }

  /**
   * Create default experience mode for a user
   * @param userId The user ID
   */
  private async createDefaultExperienceMode(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_experience_modes')
        .insert({
          user_id: userId,
          experience_mode: 'intermediate',
          onboarding_completed: false,
          beginner_tutorial_completed: false,
          beginner_preferences: DEFAULT_BEGINNER_PREFERENCES,
          intermediate_preferences: DEFAULT_INTERMEDIATE_PREFERENCES,
          expert_preferences: DEFAULT_EXPERT_PREFERENCES
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.userExperienceMode = data as UserExperienceMode;
      this.currentMode = 'intermediate';
      
    } catch (error) {
      logService.log('error', 'Failed to create default experience mode', error, 'ExperienceModeService');
      throw error;
    }
  }

  /**
   * Set up real-time subscription for experience mode changes
   */
  private setupRealtimeSubscription(): void {
    if (!this.userId) return;
    
    const subscription = supabase
      .channel('experience-mode-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_experience_modes',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => {
          const updatedMode = payload.new as UserExperienceMode;
          this.userExperienceMode = updatedMode;
          this.currentMode = updatedMode.experience_mode;
          this.emit('modeChanged', { mode: this.currentMode, preferences: this.getCurrentPreferences() });
        }
      )
      .subscribe();
  }

  /**
   * Get the current experience mode
   */
  getCurrentMode(): ExperienceMode {
    return this.currentMode;
  }

  /**
   * Get preferences for the current mode
   */
  getCurrentPreferences(): BeginnerPreferences | IntermediatePreferences | ExpertPreferences {
    if (!this.userExperienceMode) {
      // Return default preferences based on current mode
      switch (this.currentMode) {
        case 'beginner':
          return DEFAULT_BEGINNER_PREFERENCES;
        case 'expert':
          return DEFAULT_EXPERT_PREFERENCES;
        case 'intermediate':
        default:
          return DEFAULT_INTERMEDIATE_PREFERENCES;
      }
    }

    // Return preferences from user experience mode
    switch (this.currentMode) {
      case 'beginner':
        return this.userExperienceMode.beginner_preferences;
      case 'expert':
        return this.userExperienceMode.expert_preferences;
      case 'intermediate':
      default:
        return this.userExperienceMode.intermediate_preferences;
    }
  }

  /**
   * Change the user's experience mode
   * @param mode The new experience mode
   */
  async changeMode(mode: ExperienceMode): Promise<boolean> {
    if (!this.isInitialized || !this.userId) {
      logService.log('warn', 'Cannot change mode: Service not initialized', null, 'ExperienceModeService');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_experience_modes')
        .update({
          experience_mode: mode,
          last_mode_change: new Date().toISOString()
        })
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      this.currentMode = mode;
      this.emit('modeChanged', { mode, preferences: this.getCurrentPreferences() });
      
      return true;
    } catch (error) {
      logService.log('error', `Failed to change experience mode to ${mode}`, error, 'ExperienceModeService');
      return false;
    }
  }

  /**
   * Update preferences for a specific mode
   * @param mode The mode to update preferences for
   * @param preferences The new preferences
   */
  async updatePreferences(
    mode: ExperienceMode,
    preferences: Partial<BeginnerPreferences | IntermediatePreferences | ExpertPreferences>
  ): Promise<boolean> {
    if (!this.isInitialized || !this.userId) {
      logService.log('warn', 'Cannot update preferences: Service not initialized', null, 'ExperienceModeService');
      return false;
    }

    try {
      const preferencesColumn = `${mode}_preferences`;
      const currentPreferences = this.userExperienceMode?.[`${mode}_preferences`] || 
        (mode === 'beginner' ? DEFAULT_BEGINNER_PREFERENCES :
         mode === 'expert' ? DEFAULT_EXPERT_PREFERENCES :
         DEFAULT_INTERMEDIATE_PREFERENCES);

      const updatedPreferences = {
        ...currentPreferences,
        ...preferences
      };

      const { error } = await supabase
        .from('user_experience_modes')
        .update({
          [preferencesColumn]: updatedPreferences
        })
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      // Update local preferences if this is the current mode
      if (this.userExperienceMode && this.currentMode === mode) {
        this.userExperienceMode[`${mode}_preferences`] = updatedPreferences;
        this.emit('preferencesChanged', { mode, preferences: updatedPreferences });
      }

      return true;
    } catch (error) {
      logService.log('error', `Failed to update preferences for ${mode} mode`, error, 'ExperienceModeService');
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(): Promise<boolean> {
    if (!this.isInitialized || !this.userId) {
      logService.log('warn', 'Cannot complete onboarding: Service not initialized', null, 'ExperienceModeService');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_experience_modes')
        .update({
          onboarding_completed: true
        })
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      if (this.userExperienceMode) {
        this.userExperienceMode.onboarding_completed = true;
      }

      this.emit('onboardingCompleted', { userId: this.userId });
      
      return true;
    } catch (error) {
      logService.log('error', 'Failed to mark onboarding as completed', error, 'ExperienceModeService');
      return false;
    }
  }

  /**
   * Check if onboarding is completed
   */
  isOnboardingCompleted(): boolean {
    return this.userExperienceMode?.onboarding_completed || false;
  }

  /**
   * Mark beginner tutorial as completed
   */
  async completeBeginnerTutorial(): Promise<boolean> {
    if (!this.isInitialized || !this.userId) {
      logService.log('warn', 'Cannot complete beginner tutorial: Service not initialized', null, 'ExperienceModeService');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_experience_modes')
        .update({
          beginner_tutorial_completed: true
        })
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      if (this.userExperienceMode) {
        this.userExperienceMode.beginner_tutorial_completed = true;
      }

      this.emit('beginnerTutorialCompleted', { userId: this.userId });
      
      return true;
    } catch (error) {
      logService.log('error', 'Failed to mark beginner tutorial as completed', error, 'ExperienceModeService');
      return false;
    }
  }

  /**
   * Check if beginner tutorial is completed
   */
  isBeginnerTutorialCompleted(): boolean {
    return this.userExperienceMode?.beginner_tutorial_completed || false;
  }
}

// Export singleton instance
export const experienceModeService = new ExperienceModeService();
