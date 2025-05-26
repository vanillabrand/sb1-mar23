import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, User, Brain, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { ExperienceMode } from '../lib/experience-mode-service';
import { logService } from '../lib/log-service';

interface ExperienceModeSwitcherProps {
  className?: string;
}

export function ExperienceModeSwitcher({ className = '' }: ExperienceModeSwitcherProps) {
  const { mode, changeMode, isLoading } = useExperienceMode();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode | null>(null);

  // Toggle dropdown
  const toggleDropdown = () => {
    if (!isChanging) {
      setIsOpen(!isOpen);
    }
  };

  // Handle mode selection
  const handleModeSelect = (newMode: ExperienceMode) => {
    if (newMode === mode) {
      setIsOpen(false);
      return;
    }

    setSelectedMode(newMode);
    setShowConfirmation(true);
  };

  // Handle mode change confirmation
  const handleConfirmModeChange = async () => {
    if (!selectedMode) return;

    try {
      setIsChanging(true);
      const success = await changeMode(selectedMode);
      
      if (success) {
        logService.log('info', `Changed experience mode to ${selectedMode}`, null, 'ExperienceModeSwitcher');
      } else {
        logService.log('error', `Failed to change experience mode to ${selectedMode}`, null, 'ExperienceModeSwitcher');
      }
    } catch (error) {
      logService.log('error', 'Error changing experience mode', error, 'ExperienceModeSwitcher');
    } finally {
      setIsChanging(false);
      setShowConfirmation(false);
      setIsOpen(false);
    }
  };

  // Handle mode change cancellation
  const handleCancelModeChange = () => {
    setSelectedMode(null);
    setShowConfirmation(false);
  };

  // Get mode display information
  const getModeInfo = (modeType: ExperienceMode) => {
    switch (modeType) {
      case 'beginner':
        return {
          icon: <GraduationCap className="w-5 h-5" />,
          label: 'Beginner',
          description: 'Simplified interface with guided learning',
          color: 'text-neon-green'
        };
      case 'expert':
        return {
          icon: <Brain className="w-5 h-5" />,
          label: 'Expert',
          description: 'Advanced features and detailed controls',
          color: 'text-neon-raspberry'
        };
      case 'intermediate':
      default:
        return {
          icon: <User className="w-5 h-5" />,
          label: 'Intermediate',
          description: 'Standard features for regular users',
          color: 'text-neon-turquoise'
        };
    }
  };

  const currentModeInfo = getModeInfo(mode);

  return (
    <div className={`relative ${className}`}>
      {/* Current mode button */}
      <button
        onClick={toggleDropdown}
        disabled={isLoading || isChanging}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`${currentModeInfo.color}`}>
          {currentModeInfo.icon}
        </span>
        <span className="text-sm font-medium">{currentModeInfo.label} Mode</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Mode selection dropdown */}
      <AnimatePresence>
        {isOpen && !showConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 w-64 rounded-lg shadow-lg bg-gunmetal-900 border border-gunmetal-700 overflow-hidden"
          >
            <ul
              className="py-1"
              role="listbox"
              aria-labelledby="experience-mode-button"
            >
              {(['beginner', 'intermediate', 'expert'] as ExperienceMode[]).map((modeOption) => {
                const info = getModeInfo(modeOption);
                const isActive = mode === modeOption;
                
                return (
                  <li key={modeOption} role="option" aria-selected={isActive}>
                    <button
                      onClick={() => handleModeSelect(modeOption)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gunmetal-800 transition-colors ${
                        isActive ? 'bg-gunmetal-800' : ''
                      }`}
                    >
                      <span className={`mt-0.5 ${info.color}`}>
                        {info.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{info.label}</span>
                          {isActive && (
                            <Check className="w-4 h-4 text-neon-green" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {info.description}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}

        {/* Confirmation dialog */}
        {showConfirmation && selectedMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 w-72 p-4 rounded-lg shadow-lg bg-gunmetal-900 border border-gunmetal-700"
          >
            <h3 className="text-sm font-medium mb-2">Change Experience Mode?</h3>
            <p className="text-xs text-gray-400 mb-4">
              Switching to {getModeInfo(selectedMode).label} mode will change the interface and available features.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelModeChange}
                className="px-3 py-1.5 text-xs rounded-md bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModeChange}
                disabled={isChanging}
                className="px-3 py-1.5 text-xs rounded-md bg-neon-raspberry text-white hover:bg-opacity-90 transition-colors flex items-center gap-1"
              >
                {isChanging ? (
                  <>
                    <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>Changing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
