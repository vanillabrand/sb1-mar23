import { eventBus } from './event-bus';
import { logService } from './log-service';
import { demoService } from './demo-service';

interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  profit: number;
  trades: number;
}

interface MarketTypePerformance {
  dataPoints: PerformanceDataPoint[];
  totalProfit: number;
  totalTrades: number;
  lastUpdated: number;
}

interface PortfolioPerformance {
  spot: MarketTypePerformance;
  margin: MarketTypePerformance;
  futures: MarketTypePerformance;
  aggregated: MarketTypePerformance;
  lastUpdated: number;
}

/**
 * Service for tracking portfolio performance across different market types
 */
class PortfolioPerformanceService {
  private performance: PortfolioPerformance;
  private listeners: Map<string, Function[]> = new Map();
  private readonly MAX_DATA_POINTS = 100; // Maximum number of data points to keep
  private readonly STORAGE_KEY = 'portfolio_performance';
  private readonly UPDATE_INTERVAL = 60000; // 1 minute

  constructor() {
    this.performance = this.loadPerformance();
    this.setupEventListeners();
    this.startPeriodicUpdates();
  }

  /**
   * Get the current portfolio performance
   */
  getPerformance(): PortfolioPerformance {
    return this.performance;
  }

  /**
   * Get performance for a specific market type
   */
  getMarketTypePerformance(marketType: string): MarketTypePerformance | null {
    if (marketType === 'all' || marketType === 'aggregated') {
      return this.performance.aggregated;
    }

    if (this.performance[marketType]) {
      return this.performance[marketType];
    }

    return null;
  }

  /**
   * Add a performance data point for a specific market type
   */
  addPerformanceDataPoint(marketType: string, profit: number, tradeCost: number = 0): void {
    if (!marketType) marketType = 'spot';

    // Ensure the market type exists
    if (!this.performance[marketType]) {
      logService.log('warn', `Unknown market type: ${marketType}, defaulting to spot`, null, 'PortfolioPerformanceService');
      marketType = 'spot';
    }

    const timestamp = Date.now();
    const marketTypePerf = this.performance[marketType];

    // Add data point to the market type performance
    marketTypePerf.totalProfit += profit;
    marketTypePerf.totalTrades++;
    marketTypePerf.lastUpdated = timestamp;

    // Calculate the new value based on previous value and profit
    const previousValue = marketTypePerf.dataPoints.length > 0
      ? marketTypePerf.dataPoints[marketTypePerf.dataPoints.length - 1].value
      : 0;

    const newValue = previousValue + profit;

    // Add the data point
    marketTypePerf.dataPoints.push({
      timestamp,
      value: newValue,
      profit,
      trades: 1
    });

    // Limit the number of data points
    if (marketTypePerf.dataPoints.length > this.MAX_DATA_POINTS) {
      marketTypePerf.dataPoints.shift();
    }

    // Update the aggregated performance
    this.updateAggregatedPerformance();

    // Save the performance data
    this.savePerformance();

    // Notify listeners
    this.notifyListeners('performanceUpdated', {
      marketType,
      performance: this.performance
    });

    // Emit event for real-time updates
    eventBus.emit('portfolio:performance:updated', {
      marketType,
      performance: this.performance,
      timestamp
    });

    logService.log('debug', `Added performance data point for ${marketType}`,
      { profit, tradeCost, newValue }, 'PortfolioPerformanceService');
  }

  /**
   * Reset the performance data
   * @param {boolean} skipEvent - If true, don't emit the reset event (to prevent recursion)
   */
  resetPerformance(skipEvent: boolean = false): void {
    this.performance = this.createDefaultPerformance();
    this.savePerformance();

    // Notify listeners
    this.notifyListeners('performanceReset', {
      performance: this.performance
    });

    // Emit event for real-time updates, but only if not called from the event handler
    if (!skipEvent) {
      eventBus.emit('portfolio:performance:reset', {
        performance: this.performance,
        timestamp: Date.now()
      });
    }

    logService.log('info', 'Reset portfolio performance data', null, 'PortfolioPerformanceService');
  }

  /**
   * Subscribe to performance updates
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from performance updates
   */
  off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);

    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Generate demo performance data for testing
   */
  generateDemoData(): void {
    if (!demoService.isInDemoMode()) {
      logService.log('warn', 'Cannot generate demo data in live mode', null, 'PortfolioPerformanceService');
      return;
    }

    // Reset performance data without emitting events to prevent recursion
    this.resetPerformance(true);

    // Generate data points for each market type
    const marketTypes = ['spot', 'margin', 'futures'];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Generate 30 days of data
    for (let i = 30; i >= 0; i--) {
      const timestamp = now - (i * dayMs);

      marketTypes.forEach(marketType => {
        // Generate random profit/loss
        const profit = (Math.random() * 2000) - 500; // Between -500 and 1500

        // Add data point
        const marketTypePerf = this.performance[marketType];
        marketTypePerf.totalProfit += profit;
        marketTypePerf.totalTrades++;
        marketTypePerf.lastUpdated = timestamp;

        // Calculate the new value
        const previousValue = marketTypePerf.dataPoints.length > 0
          ? marketTypePerf.dataPoints[marketTypePerf.dataPoints.length - 1].value
          : 0;

        const newValue = previousValue + profit;

        // Add the data point
        marketTypePerf.dataPoints.push({
          timestamp,
          value: newValue,
          profit,
          trades: 1
        });
      });

      // Update aggregated performance
      this.updateAggregatedPerformance();
    }

    // Save the performance data
    this.savePerformance();

    // Notify listeners
    this.notifyListeners('performanceUpdated', {
      marketType: 'all',
      performance: this.performance
    });

    // Emit event for real-time updates
    eventBus.emit('portfolio:performance:updated', {
      marketType: 'all',
      performance: this.performance,
      timestamp: Date.now()
    });

    logService.log('info', 'Generated demo performance data', null, 'PortfolioPerformanceService');
  }

  /**
   * Set up event listeners for trade events
   */
  private setupEventListeners(): void {
    // Listen for trade profit events
    eventBus.subscribe('portfolio:performance:update', (event) => {
      const { profit, marketType, timestamp } = event;

      if (profit !== undefined && marketType) {
        this.addPerformanceDataPoint(marketType, profit);
      }
    });

    // Listen for trade profit events by market type
    ['spot', 'margin', 'futures'].forEach(marketType => {
      eventBus.subscribe(`trade:profit:${marketType}`, (event) => {
        const { profit } = event;

        if (profit !== undefined) {
          this.addPerformanceDataPoint(marketType, profit);
        }
      });
    });

    // Listen for reset events
    eventBus.subscribe('portfolio:performance:reset', () => {
      // Pass true to skipEvent to prevent infinite recursion
      this.resetPerformance(true);
    });
  }

  /**
   * Start periodic updates to ensure data is current
   */
  private startPeriodicUpdates(): void {
    setInterval(() => {
      // Check if we need to add a new data point (if it's been more than 1 hour since the last update)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      if (now - this.performance.lastUpdated > oneHour) {
        // Add a data point with no change for each market type
        ['spot', 'margin', 'futures'].forEach(marketType => {
          const marketTypePerf = this.performance[marketType];

          if (marketTypePerf.dataPoints.length > 0) {
            const lastValue = marketTypePerf.dataPoints[marketTypePerf.dataPoints.length - 1].value;

            marketTypePerf.dataPoints.push({
              timestamp: now,
              value: lastValue,
              profit: 0,
              trades: 0
            });

            marketTypePerf.lastUpdated = now;

            // Limit the number of data points
            if (marketTypePerf.dataPoints.length > this.MAX_DATA_POINTS) {
              marketTypePerf.dataPoints.shift();
            }
          }
        });

        // Update the aggregated performance
        this.updateAggregatedPerformance();

        // Save the performance data
        this.savePerformance();

        logService.log('debug', 'Added periodic performance data points', null, 'PortfolioPerformanceService');
      }
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Update the aggregated performance data
   */
  private updateAggregatedPerformance(): void {
    const aggregated = this.performance.aggregated;

    // Reset aggregated data
    aggregated.totalProfit = 0;
    aggregated.totalTrades = 0;
    aggregated.dataPoints = [];

    // Combine data from all market types
    ['spot', 'margin', 'futures'].forEach(marketType => {
      const marketTypePerf = this.performance[marketType];

      // Add to totals
      aggregated.totalProfit += marketTypePerf.totalProfit;
      aggregated.totalTrades += marketTypePerf.totalTrades;

      // Update last updated timestamp
      if (marketTypePerf.lastUpdated > aggregated.lastUpdated) {
        aggregated.lastUpdated = marketTypePerf.lastUpdated;
      }

      // Merge data points
      marketTypePerf.dataPoints.forEach(dataPoint => {
        // Find if we already have a data point for this timestamp
        const existingIndex = aggregated.dataPoints.findIndex(dp => dp.timestamp === dataPoint.timestamp);

        if (existingIndex !== -1) {
          // Update existing data point
          aggregated.dataPoints[existingIndex].value += dataPoint.value;
          aggregated.dataPoints[existingIndex].profit += dataPoint.profit;
          aggregated.dataPoints[existingIndex].trades += dataPoint.trades;
        } else {
          // Add new data point
          aggregated.dataPoints.push({
            timestamp: dataPoint.timestamp,
            value: dataPoint.value,
            profit: dataPoint.profit,
            trades: dataPoint.trades
          });
        }
      });
    });

    // Sort data points by timestamp
    aggregated.dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // Limit the number of data points
    if (aggregated.dataPoints.length > this.MAX_DATA_POINTS) {
      aggregated.dataPoints = aggregated.dataPoints.slice(-this.MAX_DATA_POINTS);
    }

    // Update the performance object
    this.performance.aggregated = aggregated;
    this.performance.lastUpdated = Date.now();
  }

  /**
   * Load performance data from localStorage
   */
  private loadPerformance(): PortfolioPerformance {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);

      if (storedData) {
        const parsedData = JSON.parse(storedData);

        // Validate the data structure
        if (parsedData &&
            parsedData.spot &&
            parsedData.margin &&
            parsedData.futures &&
            parsedData.aggregated) {
          return parsedData;
        }
      }
    } catch (error) {
      logService.log('error', 'Failed to load portfolio performance data', error, 'PortfolioPerformanceService');
    }

    // Return default performance data if loading fails
    return this.createDefaultPerformance();
  }

  /**
   * Save performance data to localStorage
   */
  private savePerformance(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.performance));
    } catch (error) {
      logService.log('error', 'Failed to save portfolio performance data', error, 'PortfolioPerformanceService');
    }
  }

  /**
   * Create default performance data structure
   */
  private createDefaultPerformance(): PortfolioPerformance {
    const now = Date.now();

    const createEmptyMarketTypePerformance = (): MarketTypePerformance => ({
      dataPoints: [],
      totalProfit: 0,
      totalTrades: 0,
      lastUpdated: now
    });

    return {
      spot: createEmptyMarketTypePerformance(),
      margin: createEmptyMarketTypePerformance(),
      futures: createEmptyMarketTypePerformance(),
      aggregated: createEmptyMarketTypePerformance(),
      lastUpdated: now
    };
  }

  /**
   * Notify listeners of events
   */
  private notifyListeners(event: string, data: any): void {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logService.log('error', `Error in portfolio performance listener for event ${event}`, error, 'PortfolioPerformanceService');
      }
    });
  }
}

// Create and export a singleton instance
export const portfolioPerformanceService = new PortfolioPerformanceService();
