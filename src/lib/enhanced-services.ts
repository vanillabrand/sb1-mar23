/**
 * Enhanced services for improved trading functionality
 * This file exports all enhanced services for easy import in other files
 */

import { enhancedMarketDataService } from './enhanced-market-data-service';
import { strategyAdaptationService } from './strategy-adaptation-service';
import { unifiedTradeService } from './unified-trade-service';
import { demoExchangeService } from './demo-exchange-service';
import { strategySync } from './strategy-sync';

// Export all services
export {
  enhancedMarketDataService,
  strategyAdaptationService,
  unifiedTradeService,
  demoExchangeService,
  strategySync
};

/**
 * Initialize all enhanced services
 * @returns Promise that resolves when all services are initialized
 */
export const initializeEnhancedServices = async (): Promise<void> => {
  try {
    // Get logService for proper logging
    const { logService } = await import('./log-service');

    // Check if we're in demo mode
    const { demoService } = await import('./demo-service');
    const isDemo = demoService.isInDemoMode();

    // Initialize demo exchange service if in demo mode
    if (isDemo) {
      try {
        await demoExchangeService.initialize();
        logService.log('info', 'Demo exchange service initialized', null, 'EnhancedServices');
      } catch (demoError) {
        logService.log('error', 'Failed to initialize demo exchange service', demoError, 'EnhancedServices');
      }
    }

    // Initialize strategy sync service
    try {
      await strategySync.initialize();
      logService.log('info', 'Strategy sync service initialized', null, 'EnhancedServices');
    } catch (syncError) {
      logService.log('error', 'Failed to initialize strategy sync service', syncError, 'EnhancedServices');
    }

    // Initialize enhanced market data service
    try {
      await enhancedMarketDataService.initialize();
      logService.log('info', 'Enhanced market data service initialized', null, 'EnhancedServices');
    } catch (marketDataError) {
      logService.log('error', 'Failed to initialize enhanced market data service', marketDataError, 'EnhancedServices');
    }

    // Initialize strategy adaptation service
    try {
      await strategyAdaptationService.initialize();
      logService.log('info', 'Strategy adaptation service initialized', null, 'EnhancedServices');
    } catch (strategyError) {
      logService.log('error', 'Failed to initialize strategy adaptation service', strategyError, 'EnhancedServices');
    }

    // Initialize unified trade service
    try {
      await unifiedTradeService.initialize();
      logService.log('info', 'Unified trade service initialized', null, 'EnhancedServices');
    } catch (tradeError) {
      logService.log('error', 'Failed to initialize unified trade service', tradeError, 'EnhancedServices');
    }

    logService.log('info', 'Enhanced services initialized successfully', null, 'EnhancedServices');
  } catch (error) {
    // Log error using logService instead of console
    const { logService } = await import('./log-service');
    logService.log('error', 'Failed to initialize enhanced services', error, 'EnhancedServices');
    // Don't throw - we want to continue even if initialization fails
  }
};

/**
 * Clean up all enhanced services
 * Call this when the application is shutting down
 */
export const cleanupEnhancedServices = async (): Promise<void> => {
  try {
    // Get logService for proper logging
    const { logService } = await import('./log-service');

    try {
      // Clean up enhanced market data service
      enhancedMarketDataService.cleanup();
      logService.log('info', 'Enhanced market data service cleaned up', null, 'EnhancedServices');
    } catch (marketDataError) {
      logService.log('error', 'Failed to clean up enhanced market data service', marketDataError, 'EnhancedServices');
    }

    try {
      // Clean up strategy adaptation service
      strategyAdaptationService.cleanup();
      logService.log('info', 'Strategy adaptation service cleaned up', null, 'EnhancedServices');
    } catch (strategyError) {
      logService.log('error', 'Failed to clean up strategy adaptation service', strategyError, 'EnhancedServices');
    }

    try {
      // Clean up unified trade service
      unifiedTradeService.cleanup();
      logService.log('info', 'Unified trade service cleaned up', null, 'EnhancedServices');
    } catch (tradeError) {
      logService.log('error', 'Failed to clean up unified trade service', tradeError, 'EnhancedServices');
    }

    try {
      // Clean up strategy sync service
      strategySync.cleanup();
      logService.log('info', 'Strategy sync service cleaned up', null, 'EnhancedServices');
    } catch (syncError) {
      logService.log('error', 'Failed to clean up strategy sync service', syncError, 'EnhancedServices');
    }

    try {
      // Clean up demo exchange service
      demoExchangeService.cleanup();
      logService.log('info', 'Demo exchange service cleaned up', null, 'EnhancedServices');
    } catch (demoError) {
      logService.log('error', 'Failed to clean up demo exchange service', demoError, 'EnhancedServices');
    }

    logService.log('info', 'All enhanced services cleaned up successfully', null, 'EnhancedServices');
  } catch (error) {
    console.error('Failed to clean up enhanced services', error);
  }
};
