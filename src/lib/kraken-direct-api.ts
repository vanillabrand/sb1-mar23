import { logService } from './log-service';
import { config } from './config';
import CryptoJS from 'crypto-js';

/**
 * Kraken Direct API Service
 * This service provides direct access to the Kraken API without going through CCXT
 */
class KrakenDirectApi {
  private static instance: KrakenDirectApi;
  private readonly API_URL = 'https://api.kraken.com';
  private readonly API_VERSION = '0';

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  static getInstance(): KrakenDirectApi {
    if (!KrakenDirectApi.instance) {
      KrakenDirectApi.instance = new KrakenDirectApi();
    }
    return KrakenDirectApi.instance;
  }

  /**
   * Create a signature for a Kraken API request
   * @param path API endpoint path
   * @param params Request parameters
   * @param nonce Nonce value
   * @param secret API secret
   * @returns Signature string
   */
  private createSignature(path: string, params: any, nonce: number, secret: string): string {
    // Create message to sign
    const message = params.nonce +
      CryptoJS.SHA256(
        JSON.stringify(params)
      ).toString(CryptoJS.enc.Hex);

    // Create signature
    const signature = CryptoJS.HmacSHA512(
      path + message,
      CryptoJS.enc.Base64.parse(secret)
    ).toString(CryptoJS.enc.Base64);

    return signature;
  }

  /**
   * Make a public request to the Kraken API
   * @param method API method
   * @param params Request parameters
   * @returns API response
   */
  async publicRequest(method: string, params: any = {}): Promise<any> {
    try {
      const url = `${this.API_URL}/${this.API_VERSION}/public/${method}`;

      // Log the request
      logService.log('info', `Making public request to Kraken API: ${method}`, { params }, 'KrakenDirectApi');

      // Create URL with query parameters
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });

      // Make the request
      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GiGAntic Trading Bot'
        }
      });

      // Parse the response
      const data = await response.json();

      // Check for errors
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      return data.result;
    } catch (error) {
      logService.log('error', `Failed to make public request to Kraken API: ${method}`, error, 'KrakenDirectApi');
      throw error;
    }
  }

  // Store the last used nonce to ensure it's always increasing
  private lastNonce: number = 0;

  /**
   * Generate a unique nonce that is always increasing
   * @returns A unique nonce
   */
  private generateNonce(): number {
    // Get current timestamp in microseconds
    const timestamp = Date.now() * 1000;

    // Ensure the nonce is always increasing
    const nonce = Math.max(timestamp, this.lastNonce + 1);

    // Update the last used nonce
    this.lastNonce = nonce;

    return nonce;
  }

  /**
   * Make a private request to the Kraken API
   * @param method API method
   * @param params Request parameters
   * @param apiKey API key
   * @param apiSecret API secret
   * @returns API response
   */
  async privateRequest(method: string, params: any = {}, apiKey: string, apiSecret: string): Promise<any> {
    try {
      const path = `/${this.API_VERSION}/private/${method}`;
      const url = `${this.API_URL}${path}`;

      // Add nonce to params
      const nonce = this.generateNonce();
      params = {
        ...params,
        nonce
      };

      // Create signature
      const signature = this.createSignature(path, params, nonce, apiSecret);

      // Log the request (without sensitive data)
      logService.log('info', `Making private request to Kraken API: ${method}`, {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        params: { ...params, nonce: '[REDACTED]' }
      }, 'KrakenDirectApi');

      // Create form data
      const formData = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // Make the request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'API-Key': apiKey,
          'API-Sign': signature,
          'User-Agent': 'GiGAntic Trading Bot'
        },
        body: formData
      });

      // Parse the response
      const data = await response.json();

      // Check for errors
      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      return data.result;
    } catch (error) {
      logService.log('error', `Failed to make private request to Kraken API: ${method}`, error, 'KrakenDirectApi');
      throw error;
    }
  }

  /**
   * Get server time
   * @returns Server time
   */
  async getServerTime(): Promise<any> {
    return this.publicRequest('Time');
  }

  /**
   * Get asset info
   * @param assets Asset names (comma-delimited)
   * @returns Asset info
   */
  async getAssetInfo(assets?: string): Promise<any> {
    const params: any = {};
    if (assets) {
      params.asset = assets;
    }
    return this.publicRequest('Assets', params);
  }

  /**
   * Get tradable asset pairs
   * @param pairs Asset pair names (comma-delimited)
   * @returns Asset pair info
   */
  async getAssetPairs(pairs?: string): Promise<any> {
    const params: any = {};
    if (pairs) {
      params.pair = pairs;
    }
    return this.publicRequest('AssetPairs', params);
  }

  /**
   * Get ticker information
   * @param pairs Asset pair names (comma-delimited)
   * @returns Ticker info
   */
  async getTicker(pairs: string): Promise<any> {
    return this.publicRequest('Ticker', { pair: pairs });
  }

  /**
   * Get OHLC data
   * @param pair Asset pair
   * @param interval Time frame interval in minutes (default: 1)
   * @param since Return committed OHLC data since given ID (optional)
   * @returns OHLC data
   */
  async getOHLC(pair: string, interval: number = 1, since?: number): Promise<any> {
    const params: any = {
      pair,
      interval
    };
    if (since) {
      params.since = since;
    }
    return this.publicRequest('OHLC', params);
  }

  /**
   * Get order book
   * @param pair Asset pair
   * @param count Maximum number of asks/bids (default: 100)
   * @returns Order book
   */
  async getOrderBook(pair: string, count: number = 100): Promise<any> {
    return this.publicRequest('Depth', { pair, count });
  }

  /**
   * Get recent trades
   * @param pair Asset pair
   * @param since Return trade data since given ID (optional)
   * @returns Recent trades
   */
  async getRecentTrades(pair: string, since?: number): Promise<any> {
    const params: any = { pair };
    if (since) {
      params.since = since;
    }
    return this.publicRequest('Trades', params);
  }

  /**
   * Get account balance
   * @param apiKey API key
   * @param apiSecret API secret
   * @returns Account balance
   */
  async getAccountBalance(apiKey: string, apiSecret: string): Promise<any> {
    return this.privateRequest('Balance', {}, apiKey, apiSecret);
  }

  /**
   * Get trade balance
   * @param apiKey API key
   * @param apiSecret API secret
   * @param asset Base asset (default: ZUSD)
   * @returns Trade balance
   */
  async getTradeBalance(apiKey: string, apiSecret: string, asset: string = 'ZUSD'): Promise<any> {
    return this.privateRequest('TradeBalance', { asset }, apiKey, apiSecret);
  }

  /**
   * Get open orders
   * @param apiKey API key
   * @param apiSecret API secret
   * @param trades Include trades (default: false)
   * @param userref Restrict results to given user reference id (optional)
   * @returns Open orders
   */
  async getOpenOrders(apiKey: string, apiSecret: string, trades: boolean = false, userref?: number): Promise<any> {
    const params: any = { trades };
    if (userref) {
      params.userref = userref;
    }
    return this.privateRequest('OpenOrders', params, apiKey, apiSecret);
  }

  /**
   * Get closed orders
   * @param apiKey API key
   * @param apiSecret API secret
   * @param trades Include trades (default: false)
   * @param userref Restrict results to given user reference id (optional)
   * @param start Starting unix timestamp or order tx ID (optional)
   * @param end Ending unix timestamp or order tx ID (optional)
   * @param ofs Result offset for pagination (optional)
   * @param closetime Which time to use (open, close, both) (default: both)
   * @returns Closed orders
   */
  async getClosedOrders(
    apiKey: string,
    apiSecret: string,
    trades: boolean = false,
    userref?: number,
    start?: number,
    end?: number,
    ofs?: number,
    closetime: 'open' | 'close' | 'both' = 'both'
  ): Promise<any> {
    const params: any = {
      trades,
      closetime
    };
    if (userref) params.userref = userref;
    if (start) params.start = start;
    if (end) params.end = end;
    if (ofs) params.ofs = ofs;

    return this.privateRequest('ClosedOrders', params, apiKey, apiSecret);
  }

  /**
   * Query orders info
   * @param apiKey API key
   * @param apiSecret API secret
   * @param txid Transaction IDs (comma-delimited)
   * @param trades Include trades (default: false)
   * @param userref Restrict results to given user reference id (optional)
   * @returns Orders info
   */
  async queryOrdersInfo(
    apiKey: string,
    apiSecret: string,
    txid: string,
    trades: boolean = false,
    userref?: number
  ): Promise<any> {
    const params: any = {
      txid,
      trades
    };
    if (userref) params.userref = userref;

    return this.privateRequest('QueryOrders', params, apiKey, apiSecret);
  }

  /**
   * Get trades history
   * @param apiKey API key
   * @param apiSecret API secret
   * @param type Type of trade (all, any position, closed position, closing position, no position)
   * @param trades Whether or not to include trades related to position in output (default: false)
   * @param start Starting unix timestamp or trade tx ID (optional)
   * @param end Ending unix timestamp or trade tx ID (optional)
   * @param ofs Result offset for pagination (optional)
   * @returns Trades history
   */
  async getTradesHistory(
    apiKey: string,
    apiSecret: string,
    type: 'all' | 'any position' | 'closed position' | 'closing position' | 'no position' = 'all',
    trades: boolean = false,
    start?: number,
    end?: number,
    ofs?: number
  ): Promise<any> {
    const params: any = {
      type,
      trades
    };
    if (start) params.start = start;
    if (end) params.end = end;
    if (ofs) params.ofs = ofs;

    return this.privateRequest('TradesHistory', params, apiKey, apiSecret);
  }

  /**
   * Add a new order
   * @param apiKey API key
   * @param apiSecret API secret
   * @param pair Asset pair
   * @param type Type of order (buy/sell)
   * @param ordertype Order type (market, limit, etc.)
   * @param volume Order volume in base currency
   * @param price Limit price (optional, dependent on ordertype)
   * @param leverage Amount of leverage (optional)
   * @param oflags Order flags (optional)
   * @param starttm Scheduled start time (optional)
   * @param expiretm Expiration time (optional)
   * @param userref User reference id (optional)
   * @param validate Validate inputs only, do not submit order (optional)
   * @returns Order info
   */
  async addOrder(
    apiKey: string,
    apiSecret: string,
    pair: string,
    type: 'buy' | 'sell',
    ordertype: 'market' | 'limit' | 'stop-loss' | 'take-profit' | 'stop-loss-limit' | 'take-profit-limit' | 'settle-position',
    volume: string,
    price?: string,
    leverage?: string,
    oflags?: string,
    starttm?: number,
    expiretm?: number,
    userref?: number,
    validate?: boolean
  ): Promise<any> {
    const params: any = {
      pair,
      type,
      ordertype,
      volume
    };

    if (price) params.price = price;
    if (leverage) params.leverage = leverage;
    if (oflags) params.oflags = oflags;
    if (starttm) params.starttm = starttm;
    if (expiretm) params.expiretm = expiretm;
    if (userref) params.userref = userref;
    if (validate) params.validate = validate;

    return this.privateRequest('AddOrder', params, apiKey, apiSecret);
  }

  /**
   * Cancel an open order
   * @param apiKey API key
   * @param apiSecret API secret
   * @param txid Transaction ID
   * @returns Cancel info
   */
  async cancelOrder(apiKey: string, apiSecret: string, txid: string): Promise<any> {
    return this.privateRequest('CancelOrder', { txid }, apiKey, apiSecret);
  }

  /**
   * Cancel all open orders
   * @param apiKey API key
   * @param apiSecret API secret
   * @returns Cancel info
   */
  async cancelAllOrders(apiKey: string, apiSecret: string): Promise<any> {
    return this.privateRequest('CancelAll', {}, apiKey, apiSecret);
  }

  /**
   * Get deposit methods
   * @param apiKey API key
   * @param apiSecret API secret
   * @param asset Asset being deposited
   * @returns Deposit methods
   */
  async getDepositMethods(apiKey: string, apiSecret: string, asset: string): Promise<any> {
    return this.privateRequest('DepositMethods', { asset }, apiKey, apiSecret);
  }

  /**
   * Get deposit addresses
   * @param apiKey API key
   * @param apiSecret API secret
   * @param asset Asset being deposited
   * @param method Name of the deposit method
   * @param new Generate a new address (optional)
   * @returns Deposit addresses
   */
  async getDepositAddresses(
    apiKey: string,
    apiSecret: string,
    asset: string,
    method: string,
    newAddress: boolean = false
  ): Promise<any> {
    return this.privateRequest('DepositAddresses', {
      asset,
      method,
      new: newAddress
    }, apiKey, apiSecret);
  }

  /**
   * Get withdrawal information
   * @param apiKey API key
   * @param apiSecret API secret
   * @param asset Asset being withdrawn
   * @param key Withdrawal key name, as set up on your account
   * @param amount Amount to withdraw
   * @returns Withdrawal info
   */
  async getWithdrawalInfo(
    apiKey: string,
    apiSecret: string,
    asset: string,
    key: string,
    amount: string
  ): Promise<any> {
    return this.privateRequest('WithdrawInfo', {
      asset,
      key,
      amount
    }, apiKey, apiSecret);
  }
}

export const krakenDirectApi = KrakenDirectApi.getInstance();
