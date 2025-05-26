import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { Dashboard } from './Dashboard';
import { BeginnerDashboard } from './BeginnerUI/BeginnerDashboard';
import { ExpertDashboard } from './ExpertUI/ExpertDashboard';
import { strategyService } from '../lib/strategy-service';
import { Strategy, MonitoringStatus } from '../lib/types';
import { logService } from '../lib/log-service';

export function AdaptiveDashboard() {
  const { mode, preferences } = useExperienceMode();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [monitoringStatuses, setMonitoringStatuses] = useState<Record<string, MonitoringStatus>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load strategies and monitoring statuses
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load strategies
        const loadedStrategies = await strategyService.getStrategies();
        setStrategies(loadedStrategies);

        // Load monitoring statuses
        const statuses = await strategyService.getMonitoringStatuses();
        const statusMap: Record<string, MonitoringStatus> = {};

        statuses.forEach(status => {
          const strategyId = status.strategyId || status.strategy_id;
          if (strategyId) {
            statusMap[strategyId] = status;
          }
        });

        setMonitoringStatuses(statusMap);
      } catch (error) {
        logService.log('error', 'Failed to load dashboard data', error, 'AdaptiveDashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up event listeners for updates
    const handleStrategiesUpdated = () => {
      strategyService.getStrategies().then(setStrategies);
    };

    const handleMonitoringStatusesUpdated = () => {
      strategyService.getMonitoringStatuses().then(statuses => {
        const statusMap: Record<string, MonitoringStatus> = {};

        statuses.forEach(status => {
          const strategyId = status.strategyId || status.strategy_id;
          if (strategyId) {
            statusMap[strategyId] = status;
          }
        });

        setMonitoringStatuses(statusMap);
      });
    };

    document.addEventListener('strategies:updated', handleStrategiesUpdated);
    document.addEventListener('monitoring:updated', handleMonitoringStatusesUpdated);

    return () => {
      document.removeEventListener('strategies:updated', handleStrategiesUpdated);
      document.removeEventListener('monitoring:updated', handleMonitoringStatusesUpdated);
    };
  }, []);

  // Render the appropriate dashboard based on the user's experience mode
  return (
    <AnimatePresence mode="wait">
      {mode === 'beginner' && (
        <motion.div
          key="beginner-dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BeginnerDashboard />
        </motion.div>
      )}

      {mode === 'intermediate' && (
        <motion.div
          key="intermediate-dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Dashboard strategies={strategies} monitoringStatuses={monitoringStatuses} />
        </motion.div>
      )}

      {mode === 'expert' && (
        <motion.div
          key="expert-dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ExpertDashboard strategies={strategies} monitoringStatuses={monitoringStatuses} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
