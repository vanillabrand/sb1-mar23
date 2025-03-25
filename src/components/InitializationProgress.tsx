import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { initializationProgress, type InitializationStep } from '../lib/initialization-progress';

interface InitializationProgressProps {
  onComplete?: () => void;
}

export function InitializationProgress({ onComplete }: InitializationProgressProps) {
  const [steps, setSteps] = React.useState<InitializationStep[]>([]);
  const [totalProgress, setTotalProgress] = React.useState(0);

  React.useEffect(() => {
    const handleStepAdded = (step: InitializationStep) => {
      setSteps(prev => [...prev, step]);
    };

    const handleStepUpdated = (step: InitializationStep) => {
      setSteps(prev => prev.map(s => s.id === step.id ? step : s));
    };

    const handleProgressUpdated = (progress: number) => {
      setTotalProgress(progress);
      if (progress === 100) {
        onComplete?.();
      }
    };

    const handleReset = () => {
      setSteps([]);
      setTotalProgress(0);
    };

    initializationProgress.on('stepAdded', handleStepAdded);
    initializationProgress.on('stepUpdated', handleStepUpdated);
    initializationProgress.on('progressUpdated', handleProgressUpdated);
    initializationProgress.on('reset', handleReset);

    // Initial state
    setSteps(initializationProgress.getSteps());
    setTotalProgress(initializationProgress.getTotalProgress());

    return () => {
      initializationProgress.off('stepAdded', handleStepAdded);
      initializationProgress.off('stepUpdated', handleStepUpdated);
      initializationProgress.off('progressUpdated', handleProgressUpdated);
      initializationProgress.off('reset', handleReset);
    };
  }, [onComplete]);

  const getStepIcon = (step: InitializationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-neon-turquoise" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-neon-pink" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-neon-yellow animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gunmetal-800"
      >
        <h2 className="text-xl font-bold gradient-text mb-6">Initializing GIGAntic</h2>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Overall Progress</span>
            <span className="text-neon-turquoise font-medium">{totalProgress}%</span>
          </div>
          <div className="h-2 bg-gunmetal-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-neon-turquoise"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="bg-gunmetal-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getStepIcon(step)}
                  <span className="text-sm font-medium text-gray-200">{step.name}</span>
                </div>
                <span className="text-sm font-mono text-gray-400">{step.progress}%</span>
              </div>
              {step.message && (
                <p className={`text-xs mt-1 ${
                  step.status === 'error' ? 'text-neon-pink' : 'text-gray-400'
                }`}>
                  {step.message}
                </p>
              )}
              <div className="mt-2 h-1 bg-gunmetal-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    step.status === 'completed' ? 'bg-neon-turquoise' :
                    step.status === 'error' ? 'bg-neon-pink' :
                    'bg-neon-yellow'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${step.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}