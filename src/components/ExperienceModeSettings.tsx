import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  GraduationCap, 
  User, 
  Brain, 
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Save
} from 'lucide-react';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { ExperienceMode } from '../lib/experience-mode-service';
import { AnimatedPanel } from './AnimatedPanel';
import { toast } from 'react-hot-toast';

export function ExperienceModeSettings() {
  const { currentMode, changeMode, getCurrentPreferences, updatePreferences } = useExperienceMode();
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(currentMode);
  const [isChanging, setIsChanging] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const modes = [
    {
      id: 'beginner' as ExperienceMode,
      name: 'Beginner',
      icon: <GraduationCap className="w-8 h-8" />,
      description: 'Perfect for newcomers to crypto trading',
      features: [
        'Simplified dashboard with essential information',
        'Guided tutorials and educational content',
        'Pre-configured trading strategies',
        'Step-by-step guidance for all actions',
        'Safety reminders and risk warnings',
        'Basic portfolio overview'
      ],
      color: 'text-neon-green',
      bgColor: 'bg-neon-green/10',
      borderColor: 'border-neon-green/30'
    },
    {
      id: 'intermediate' as ExperienceMode,
      name: 'Intermediate',
      icon: <User className="w-8 h-8" />,
      description: 'For traders with some crypto experience',
      features: [
        'Standard dashboard with comprehensive data',
        'Strategy customization options',
        'Performance metrics and analytics',
        'Risk management tools',
        'Market analysis and insights',
        'Advanced charting capabilities'
      ],
      color: 'text-neon-turquoise',
      bgColor: 'bg-neon-turquoise/10',
      borderColor: 'border-neon-turquoise/30'
    },
    {
      id: 'expert' as ExperienceMode,
      name: 'Expert',
      icon: <Brain className="w-8 h-8" />,
      description: 'Full feature set for professional traders',
      features: [
        'Advanced dashboard with all metrics',
        'Custom indicator development',
        'API integration and automation',
        'Advanced risk controls and limits',
        'Multi-exchange support',
        'Custom strategy development',
        'Professional analytics suite'
      ],
      color: 'text-neon-raspberry',
      bgColor: 'bg-neon-raspberry/10',
      borderColor: 'border-neon-raspberry/30'
    }
  ];

  const handleModeChange = async () => {
    if (selectedMode === currentMode) return;

    setIsChanging(true);
    try {
      const success = await changeMode(selectedMode);
      if (success) {
        toast.success(`Switched to ${modes.find(m => m.id === selectedMode)?.name} mode!`);
        setShowConfirmation(false);
      } else {
        toast.error('Failed to change experience mode');
      }
    } catch (error) {
      toast.error('Error changing experience mode');
    } finally {
      setIsChanging(false);
    }
  };

  const handleModeSelect = (mode: ExperienceMode) => {
    setSelectedMode(mode);
    if (mode !== currentMode) {
      setShowConfirmation(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 pb-24 sm:pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Settings className="w-8 h-8 text-neon-turquoise" />
          <h1 className="text-3xl font-bold gradient-text">Experience Mode Settings</h1>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Choose your experience level to customize the interface and features to match your trading expertise.
        </p>
      </motion.div>

      {/* Current Mode Display */}
      <AnimatedPanel index={0} className="panel-metallic rounded-xl p-6 panel-shadow">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-lg ${modes.find(m => m.id === currentMode)?.bgColor}`}>
            {modes.find(m => m.id === currentMode)?.icon}
          </div>
          <div>
            <h3 className="text-xl font-semibold">Current Mode</h3>
            <p className={`text-lg font-medium ${modes.find(m => m.id === currentMode)?.color}`}>
              {modes.find(m => m.id === currentMode)?.name}
            </p>
          </div>
        </div>
        <p className="text-gray-400">
          {modes.find(m => m.id === currentMode)?.description}
        </p>
      </AnimatedPanel>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {modes.map((mode, index) => (
          <AnimatedPanel 
            key={mode.id} 
            index={index + 1} 
            className={`panel-metallic rounded-xl p-6 panel-shadow cursor-pointer transition-all duration-300 ${
              selectedMode === mode.id 
                ? `${mode.borderColor} border-2 ${mode.bgColor}` 
                : 'border border-gunmetal-700 hover:border-gunmetal-600'
            }`}
            onClick={() => handleModeSelect(mode.id)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${mode.bgColor} ${mode.color}`}>
                {mode.icon}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{mode.name}</h3>
                {currentMode === mode.id && (
                  <div className="flex items-center gap-1 text-sm text-neon-green">
                    <CheckCircle className="w-4 h-4" />
                    Current
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-gray-400 mb-4">{mode.description}</p>
            
            <div className="space-y-2">
              <h4 className="font-medium text-white">Features:</h4>
              <ul className="space-y-1">
                {mode.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {mode.features.length > 3 && (
                  <li className="text-sm text-gray-500">
                    +{mode.features.length - 3} more features...
                  </li>
                )}
              </ul>
            </div>
          </AnimatedPanel>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gunmetal-900 rounded-xl p-6 max-w-md w-full mx-4 border border-gunmetal-700"
          >
            <h3 className="text-xl font-semibold mb-4">Confirm Mode Change</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to switch to{' '}
              <span className={modes.find(m => m.id === selectedMode)?.color}>
                {modes.find(m => m.id === selectedMode)?.name}
              </span>{' '}
              mode? This will change your interface and available features.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gunmetal-700 text-white rounded-lg hover:bg-gunmetal-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModeChange}
                disabled={isChanging}
                className="flex-1 px-4 py-2 bg-neon-turquoise text-black rounded-lg hover:bg-neon-turquoise/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isChanging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
