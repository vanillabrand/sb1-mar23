/**
 * Enhanced services for improved trading functionality
 * This file exports all enhanced services for easy import in other files
 */

import { enhancedMarketDataService } from './enhanced-market-data-service';
import { strategyAdaptationService } from './strategy-adaptation-service';
import { unifiedTradeService } from './unified-trade-service';

// Export all services
export {
  enhancedMarketDataService,
  strategyAdaptationService,
  unifiedTradeService
};

/**
 * Initialize all enhanced services
 * @returns Promise that resolves when all services are initialized
 */
export const initializeEnhancedServices = async (): Promise<void> => {
  try {
    // Initialize enhanced market data service
    await enhancedMarketDataService.initialize();

    // Initialize strategy adaptation service
    await strategyAdaptationService.initialize();

    // Initialize unified trade service
    await unifiedTradeService.initialize();

    // Log success using logService instead of console
    const { logService } = await import('./log-service');
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

    logService.log('info', 'All enhanced services cleaned up successfully', null, 'EnhancedServices');
  } catch (error) {
    console.error('Failed to clean up enhanced services', error);
  }
};
