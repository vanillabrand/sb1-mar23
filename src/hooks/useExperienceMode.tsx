import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { experienceModeService, ExperienceMode, BeginnerPreferences, IntermediatePreferences, ExpertPreferences } from '../lib/experience-mode-service';
import { useAuth } from './useAuth';
import { logService } from '../lib/log-service';

// Define the context type
interface ExperienceModeContextType {
  mode: ExperienceMode;
  preferences: BeginnerPreferences | IntermediatePreferences | ExpertPreferences;
  isLoading: boolean;
  changeMode: (mode: ExperienceMode) => Promise<boolean>;
  updatePreferences: (preferences: Partial<BeginnerPreferences | IntermediatePreferences | ExpertPreferences>) => Promise<boolean>;
  isOnboardingCompleted: boolean;
  completeOnboarding: () => Promise<boolean>;
  isBeginnerTutorialCompleted: boolean;
  completeBeginnerTutorial: () => Promise<boolean>;
}

// Create the context with a default value
const ExperienceModeContext = createContext<ExperienceModeContextType>({
  mode: 'intermediate',
  preferences: {
    showTooltips: true,
    showGuidedHelp: false,
    simplifiedUI: false,
    dashboardLayout: 'standard',
    showAdvancedMetrics: false
  } as IntermediatePreferences,
  isLoading: true,
  changeMode: async () => false,
  updatePreferences: async () => false,
  isOnboardingCompleted: false,
  completeOnboarding: async () => false,
  isBeginnerTutorialCompleted: false,
  completeBeginnerTutorial: async () => false
});

// Provider component
interface ExperienceModeProviderProps {
  children: ReactNode;
}

export const ExperienceModeProvider: React.FC<ExperienceModeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ExperienceMode>('intermediate');
  const [preferences, setPreferences] = useState<BeginnerPreferences | IntermediatePreferences | ExpertPreferences>({
    showTooltips: true,
    showGuidedHelp: false,
    simplifiedUI: false,
    dashboardLayout: 'standard',
    showAdvancedMetrics: false
  } as IntermediatePreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [isBeginnerTutorialCompleted, setIsBeginnerTutorialCompleted] = useState(false);

  // Initialize the experience mode service when the user changes
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const initializeExperienceMode = async () => {
      try {
        setIsLoading(true);
        await experienceModeService.initialize(user.id);
        
        // Get current mode and preferences
        const currentMode = experienceModeService.getCurrentMode();
        const currentPreferences = experienceModeService.getCurrentPreferences();
        
        setMode(currentMode);
        setPreferences(currentPreferences);
        setIsOnboardingCompleted(experienceModeService.isOnboardingCompleted());
        setIsBeginnerTutorialCompleted(experienceModeService.isBeginnerTutorialCompleted());
        
      } catch (error) {
        logService.log('error', 'Failed to initialize experience mode', error, 'useExperienceMode');
      } finally {
        setIsLoading(false);
      }
    };

    initializeExperienceMode();

    // Set up event listeners
    const handleModeChanged = (data: { mode: ExperienceMode, preferences: any }) => {
      setMode(data.mode);
      setPreferences(data.preferences);
    };

    const handlePreferencesChanged = (data: { mode: ExperienceMode, preferences: any }) => {
      if (data.mode === mode) {
        setPreferences(data.preferences);
      }
    };

    const handleOnboardingCompleted = () => {
      setIsOnboardingCompleted(true);
    };

    const handleBeginnerTutorialCompleted = () => {
      setIsBeginnerTutorialCompleted(true);
    };

    experienceModeService.on('modeChanged', handleModeChanged);
    experienceModeService.on('preferencesChanged', handlePreferencesChanged);
    experienceModeService.on('onboardingCompleted', handleOnboardingCompleted);
    experienceModeService.on('beginnerTutorialCompleted', handleBeginnerTutorialCompleted);

    return () => {
      experienceModeService.off('modeChanged', handleModeChanged);
      experienceModeService.off('preferencesChanged', handlePreferencesChanged);
      experienceModeService.off('onboardingCompleted', handleOnboardingCompleted);
      experienceModeService.off('beginnerTutorialCompleted', handleBeginnerTutorialCompleted);
    };
  }, [user]);

  // Function to change the experience mode
  const changeMode = async (newMode: ExperienceMode): Promise<boolean> => {
    try {
      const success = await experienceModeService.changeMode(newMode);
      if (success) {
        setMode(newMode);
        setPreferences(experienceModeService.getCurrentPreferences());
      }
      return success;
    } catch (error) {
      logService.log('error', `Failed to change experience mode to ${newMode}`, error, 'useExperienceMode');
      return false;
    }
  };

  // Function to update preferences
  const updatePreferences = async (
    newPreferences: Partial<BeginnerPreferences | IntermediatePreferences | ExpertPreferences>
  ): Promise<boolean> => {
    try {
      const success = await experienceModeService.updatePreferences(mode, newPreferences);
      if (success) {
        setPreferences({
          ...preferences,
          ...newPreferences
        });
      }
      return success;
    } catch (error) {
      logService.log('error', 'Failed to update preferences', error, 'useExperienceMode');
      return false;
    }
  };

  // Function to complete onboarding
  const completeOnboarding = async (): Promise<boolean> => {
    try {
      const success = await experienceModeService.completeOnboarding();
      if (success) {
        setIsOnboardingCompleted(true);
      }
      return success;
    } catch (error) {
      logService.log('error', 'Failed to complete onboarding', error, 'useExperienceMode');
      return false;
    }
  };

  // Function to complete beginner tutorial
  const completeBeginnerTutorial = async (): Promise<boolean> => {
    try {
      const success = await experienceModeService.completeBeginnerTutorial();
      if (success) {
        setIsBeginnerTutorialCompleted(true);
      }
      return success;
    } catch (error) {
      logService.log('error', 'Failed to complete beginner tutorial', error, 'useExperienceMode');
      return false;
    }
  };

  // Create the context value
  const contextValue: ExperienceModeContextType = {
    mode,
    preferences,
    isLoading,
    changeMode,
    updatePreferences,
    isOnboardingCompleted,
    completeOnboarding,
    isBeginnerTutorialCompleted,
    completeBeginnerTutorial
  };

  return (
    <ExperienceModeContext.Provider value={contextValue}>
      {children}
    </ExperienceModeContext.Provider>
  );
};

// Custom hook to use the experience mode context
export const useExperienceMode = () => useContext(ExperienceModeContext);
