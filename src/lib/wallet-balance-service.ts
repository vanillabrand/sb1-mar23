import { EventEmitter } from './event-emitter';
import { ccxtService } from './ccxt-service';
import { logService } from './log-service';
import { demoService } from './demo-service';
import { WalletBalance } from './types';

/**
 * Service for managing wallet balances from exchanges
 * Handles fetching balances, monitoring changes, and providing balance information
 */
class WalletBalanceService extends EventEmitter {
  private static instance: WalletBalanceService;
  private balances: Map<string, WalletBalance> = new Map();
  private lastUpdated: number = 0;
  private updateInterval: number = 30000; // 30 seconds
  private intervalId: number | null = null;
  private isInitialized: boolean = false;
  private isUpdating: boolean = false;

  private constructor() {
    super();
    // Auto-initialize when service is created
    this.initialize().catch(error => {
      logService.log('error', 'Failed to auto-initialize wallet balance service', error, 'WalletBalanceService');
    });
  }

  static getInstance(): WalletBalanceService {
    if (!WalletBalanceService.instance) {
      WalletBalanceService.instance = new WalletBalanceService();
    }
    return WalletBalanceService.instance;
  }

  /**
   * Initialize the wallet balance service
   * Starts periodic balance updates
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Fetch initial balances
      await this.fetchBalances();

      // Start periodic updates
      this.startPeriodicUpdates();

      this.isInitialized = true;
      logService.log('info', 'Wallet balance service initialized', null, 'WalletBalanceService');
    } catch (error) {
      logService.log('error', 'Failed to initialize wallet balance service', error, 'WalletBalanceService');
      throw error;
    }
  }

  /**
   * Start periodic balance updates
   */
  private startPeriodicUpdates(): void {
    if (this.intervalId !== null) return;

    this.intervalId = window.setInterval(() => {
      this.fetchBalances().catch(error => {
        logService.log('error', 'Error in periodic balance update', error, 'WalletBalanceService');
      });
    }, this.updateInterval);
  }

  /**
   * Stop periodic balance updates
   */
  stopPeriodicUpdates(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Fetch balances from the exchange
   * In demo mode, uses Binance TestNet or generates mock data
   */
  async fetchBalances(): Promise<void> {
    if (this.isUpdating) return;

    try {
      this.isUpdating = true;

      if (demoService.isInDemoMode()) {
        await this.fetchTestNetBalances();
      } else {
        await this.fetchExchangeBalances();
      }

      this.lastUpdated = Date.now();
      this.emit('balancesUpdated', this.getBalances());
    } catch (error) {
      logService.log('error', 'Failed to fetch balances', error, 'WalletBalanceService');
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Fetch balances from Binance TestNet in demo mode
   */
  private async fetchTestNetBalances(): Promise<void> {
    try {
      // Get the exchange instance (Binance TestNet)
      const exchange = await ccxtService.getExchange('binance', true);

      if (!exchange) {
        // If exchange is not available, use mock data
        this.generateMockBalances();
        return;
      }

      // Fetch balances from TestNet
      const balanceData = await exchange.fetchBalance();

      // Process and store the balances
      if (balanceData && balanceData.total) {
        // Store USDT balance
        const usdtBalance = balanceData.free.USDT || 0;
        const usdtUsed = balanceData.used.USDT || 0;
        const usdtTotal = balanceData.total.USDT || 0;

        this.balances.set('USDT', {
          free: parseFloat(usdtBalance.toString()),
          used: parseFloat(usdtUsed.toString()),
          total: parseFloat(usdtTotal.toString())
        });

        logService.log('info', 'TestNet balances fetched successfully',
          { USDT: this.balances.get('USDT') }, 'WalletBalanceService');
      } else {
        // If no balance data, use mock data
        this.generateMockBalances();
      }
    } catch (error) {
      logService.log('error', 'Failed to fetch TestNet balances, using mock data', error, 'WalletBalanceService');
      this.generateMockBalances();
    }
  }

  /**
   * Fetch balances from the connected exchange
   */
  private async fetchExchangeBalances(): Promise<void> {
    try {
      // Get the current exchange instance
      const exchange = ccxtService.getCurrentExchange();

      if (!exchange) {
        // If no exchange is connected, use mock data
        this.generateMockBalances();
        return;
      }

      // Fetch balances from the exchange
      const balanceData = await exchange.fetchBalance();

      // Process and store the balances
      if (balanceData && balanceData.total) {
        // Store USDT balance
        const usdtBalance = balanceData.free.USDT || 0;
        const usdtUsed = balanceData.used.USDT || 0;
        const usdtTotal = balanceData.total.USDT || 0;

        this.balances.set('USDT', {
          free: parseFloat(usdtBalance.toString()),
          used: parseFloat(usdtUsed.toString()),
          total: parseFloat(usdtTotal.toString())
        });

        logService.log('info', 'Exchange balances fetched successfully',
          { USDT: this.balances.get('USDT') }, 'WalletBalanceService');
      } else {
        // If no balance data, use mock data
        this.generateMockBalances();
      }
    } catch (error) {
      logService.log('error', 'Failed to fetch exchange balances, using mock data', error, 'WalletBalanceService');
      this.generateMockBalances();
    }
  }

  /**
   * Generate mock balances for demo mode
   */
  private generateMockBalances(): void {
    // Create a mock USDT balance
    this.balances.set('USDT', {
      free: 10000,
      used: 0,
      total: 10000
    });

    logService.log('info', 'Generated mock balances',
      { USDT: this.balances.get('USDT') }, 'WalletBalanceService');
  }

  /**
   * Get all balances
   */
  getBalances(): Map<string, WalletBalance> {
    return new Map(this.balances);
  }

  /**
   * Get the balance for a specific currency
   * @param currency The currency symbol (e.g., 'USDT')
   */
  getBalance(currency: string = 'USDT'): WalletBalance | null {
    return this.balances.get(currency) || null;
  }

  /**
   * Get the available (free) balance for a specific currency
   * @param currency The currency symbol (e.g., 'USDT')
   */
  getAvailableBalance(currency: string = 'USDT'): number {
    const balance = this.balances.get(currency);
    return balance ? balance.free : 0;
  }

  /**
   * Get the total balance for a specific currency
   * @param currency The currency symbol (e.g., 'USDT')
   */
  getTotalBalance(currency: string = 'USDT'): number {
    const balance = this.balances.get(currency);
    return balance ? balance.total : 0;
  }

  /**
   * Check if there is sufficient balance for a given amount
   * @param amount The amount to check
   * @param currency The currency symbol (e.g., 'USDT')
   */
  hasSufficientBalance(amount: number, currency: string = 'USDT'): boolean {
    const availableBalance = this.getAvailableBalance(currency);
    return availableBalance >= amount;
  }

  /**
   * Get the time of the last balance update
   */
  getLastUpdated(): number {
    return this.lastUpdated;
  }

  /**
   * Force a balance update
   */
  async refreshBalances(): Promise<void> {
    await this.fetchBalances();
  }
}

export const walletBalanceService = WalletBalanceService.getInstance();
