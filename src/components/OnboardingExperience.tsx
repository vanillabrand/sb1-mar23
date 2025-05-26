import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, User, Brain, ChevronRight, X, Check } from 'lucide-react';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { ExperienceMode } from '../lib/experience-mode-service';
import { logService } from '../lib/log-service';

interface OnboardingExperienceProps {
  onComplete: () => void;
}

export function OnboardingExperience({ onComplete }: OnboardingExperienceProps) {
  const { changeMode, completeOnboarding } = useExperienceMode();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>('intermediate');
  const [isChanging, setIsChanging] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const steps = [
    {
      title: 'Welcome to the Adaptive Crypto Trading Platform',
      description: 'Let\'s set up your experience to match your trading knowledge and preferences.',
      content: (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-24 h-24 mb-6 rounded-full bg-gunmetal-800 flex items-center justify-center">
            <img src="/logo.svg" alt="Logo" className="w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold mb-2 gradient-text">Welcome to Your Trading Journey</h2>
          <p className="text-gray-400 text-center max-w-md mb-6">
            Our platform adapts to your experience level, providing the right tools and guidance as you need them.
          </p>
        </div>
      )
    },
    {
      title: 'Choose Your Experience Level',
      description: 'Select the mode that best matches your trading knowledge and experience.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
          {/* Beginner Mode Card */}
          <ExperienceModeCard
            mode="beginner"
            icon={<GraduationCap className="w-8 h-8" />}
            title="Beginner"
            description="I'm new to cryptocurrency trading and want guidance."
            features={[
              'Simplified dashboard',
              'Educational resources',
              'Guided setup process',
              'Pre-configured strategies',
              'Visual explanations'
            ]}
            isSelected={selectedMode === 'beginner'}
            onSelect={() => setSelectedMode('beginner')}
          />

          {/* Intermediate Mode Card */}
          <ExperienceModeCard
            mode="intermediate"
            icon={<User className="w-8 h-8" />}
            title="Intermediate"
            description="I have some experience with crypto trading."
            features={[
              'Standard dashboard',
              'Strategy customization',
              'Performance metrics',
              'Risk management tools',
              'Market analysis'
            ]}
            isSelected={selectedMode === 'intermediate'}
            onSelect={() => setSelectedMode('intermediate')}
          />

          {/* Expert Mode Card */}
          <ExperienceModeCard
            mode="expert"
            icon={<Brain className="w-8 h-8" />}
            title="Expert"
            description="I'm an experienced trader looking for advanced tools."
            features={[
              'Advanced dashboard',
              'Technical indicators',
              'API integration',
              'Advanced risk controls',
              'Performance analytics'
            ]}
            isSelected={selectedMode === 'expert'}
            onSelect={() => setSelectedMode('expert')}
          />
        </div>
      )
    },
    {
      title: 'Confirm Your Selection',
      description: 'You can always change your experience mode later in settings.',
      content: (
        <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-gunmetal-800 flex items-center justify-center mb-6">
            {selectedMode === 'beginner' && <GraduationCap className="w-10 h-10 text-neon-green" />}
            {selectedMode === 'intermediate' && <User className="w-10 h-10 text-neon-turquoise" />}
            {selectedMode === 'expert' && <Brain className="w-10 h-10 text-neon-raspberry" />}
          </div>
          <h3 className="text-xl font-bold mb-2">
            {selectedMode === 'beginner' && 'Beginner Mode'}
            {selectedMode === 'intermediate' && 'Intermediate Mode'}
            {selectedMode === 'expert' && 'Expert Mode'}
          </h3>
          <p className="text-gray-400 text-center max-w-md mb-6">
            {selectedMode === 'beginner' &&
              'You\'ll get a simplified interface with guided learning to help you start your crypto trading journey.'}
            {selectedMode === 'intermediate' &&
              'You\'ll get a standard interface with the essential tools needed for effective crypto trading.'}
            {selectedMode === 'expert' &&
              'You\'ll get an advanced interface with detailed controls and technical tools for professional trading.'}
          </p>
          <p className="text-sm text-gray-500 italic">
            You can change your experience mode at any time from the settings menu.
          </p>
        </div>
      )
    }
  ];

  // Handle next step
  const handleNextStep = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save the selected mode and complete onboarding
      try {
        setIsCompleting(true);

        // Change the experience mode
        setIsChanging(true);
        const modeChangeSuccess = await changeMode(selectedMode);
        setIsChanging(false);

        if (!modeChangeSuccess) {
          throw new Error(`Failed to change mode to ${selectedMode}`);
        }

        // Mark onboarding as completed
        const onboardingSuccess = await completeOnboarding();

        if (!onboardingSuccess) {
          throw new Error('Failed to complete onboarding');
        }

        // Call the onComplete callback
        onComplete();
      } catch (error) {
        logService.log('error', 'Error completing onboarding', error, 'OnboardingExperience');
      } finally {
        setIsCompleting(false);
      }
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle skip onboarding
  const handleSkipOnboarding = async () => {
    try {
      setIsCompleting(true);
      const success = await completeOnboarding();

      if (success) {
        onComplete();
      } else {
        throw new Error('Failed to complete onboarding');
      }
    } catch (error) {
      logService.log('error', 'Error skipping onboarding', error, 'OnboardingExperience');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl mx-4 panel-metallic rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gunmetal-800">
          <div>
            <h2 className="text-lg font-bold">{steps[currentStep].title}</h2>
            <p className="text-sm text-gray-400">{steps[currentStep].description}</p>
          </div>
          <button
            onClick={handleSkipOnboarding}
            className="text-gray-400 hover:text-white p-1 rounded-full transition-colors"
            disabled={isCompleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {steps[currentStep].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gunmetal-800">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-neon-raspberry' : 'bg-gunmetal-700'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePreviousStep}
                className="px-4 py-2 text-sm rounded-md bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
                disabled={isChanging || isCompleting}
              >
                Back
              </button>
            )}
            <button
              onClick={handleNextStep}
              className="px-4 py-2 text-sm rounded-md bg-neon-raspberry text-white hover:bg-opacity-90 transition-colors flex items-center gap-1"
              disabled={isChanging || isCompleting}
            >
              {isChanging || isCompleting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>{currentStep === steps.length - 1 ? 'Completing...' : 'Next...'}</span>
                </>
              ) : (
                <>
                  <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Experience mode card component
interface ExperienceModeCardProps {
  mode: ExperienceMode;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  isSelected: boolean;
  onSelect: () => void;
}

function ExperienceModeCard({
  mode,
  icon,
  title,
  description,
  features,
  isSelected,
  onSelect
}: ExperienceModeCardProps) {
  // Determine color based on mode
  const getColor = () => {
    switch (mode) {
      case 'beginner':
        return 'text-neon-green';
      case 'expert':
        return 'text-neon-raspberry';
      case 'intermediate':
      default:
        return 'text-neon-turquoise';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`rounded-xl p-4 cursor-pointer transition-all duration-300 ${
        isSelected
          ? 'bg-gunmetal-800 border-2 border-' + getColor().replace('text-', '')
          : 'bg-gunmetal-900 border border-gunmetal-800 hover:bg-gunmetal-800'
      }`}
      onClick={onSelect}
    >
      <div className="flex flex-col h-full">
        <div className={`${getColor()} mb-4`}>{icon}</div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        <div className="flex-grow">
          <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Features</h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-gray-400 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 pt-4 border-t border-gunmetal-800">
          <button
            className={`w-full py-2 rounded-md text-sm font-medium ${
              isSelected
                ? `bg-${getColor().replace('text-', '')} text-white`
                : 'bg-gunmetal-700 text-white hover:bg-gunmetal-600'
            }`}
            onClick={onSelect}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
