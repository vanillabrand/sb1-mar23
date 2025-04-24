import { logService } from './log-service';
import { eventBus } from './event-bus';

// Event bus for network error events
type ErrorListener = (error: Error) => void;

/**
 * Network error handler options
 */
export interface NetworkErrorHandlerOptions {
  /** Whether to show error UI */
  showErrorUI?: boolean;
  /** Whether to log errors */
  logErrors?: boolean;
  /** Whether to emit events */
  emitEvents?: boolean;
  /** Default error message */
  defaultErrorMessage?: string;
}

class NetworkErrorHandler {
  private static instance: NetworkErrorHandler;
  private listeners: ErrorListener[] = [];
  private lastError: Error | null = null;
  private isModalOpen = false;

  private constructor() {}

  static getInstance(): NetworkErrorHandler {
    if (!NetworkErrorHandler.instance) {
      NetworkErrorHandler.instance = new NetworkErrorHandler();
    }
    return NetworkErrorHandler.instance;
  }

  // Default options
  private readonly DEFAULT_OPTIONS: NetworkErrorHandlerOptions = {
    showErrorUI: true,
    logErrors: true,
    emitEvents: true,
    defaultErrorMessage: 'Network connection failed. Please check your internet connection or try using a VPN.'
  };

  /**
   * Handle a network error
   * @param error The error to handle
   * @param context The context where the error occurred
   * @param options Error handler options
   */
  handleError(error: Error, context: string = 'unknown', options: NetworkErrorHandlerOptions = {}): void {
    // Merge options with defaults
    const mergedOptions: NetworkErrorHandlerOptions = {
      ...this.DEFAULT_OPTIONS,
      ...options
    };

    // Get user-friendly error message
    const errorMessage = this.formatNetworkErrorMessage(error);

    // Log the error if enabled
    if (mergedOptions.logErrors) {
      logService.log('error', `Network error in ${context}`, {
        error: error.message,
        stack: error.stack,
        context,
        userMessage: errorMessage
      }, 'NetworkErrorHandler');
    }

    this.lastError = error;

    // Emit event if enabled
    if (mergedOptions.emitEvents) {
      eventBus.emit('networkError', {
        error,
        context,
        message: errorMessage
      });
    }

    // Show error UI if enabled and modal is not already open
    if (mergedOptions.showErrorUI && !this.isModalOpen) {
      this.notifyListeners(error);

      // Also emit event for UI components that listen to the event bus
      eventBus.emit('showErrorUI', {
        message: errorMessage,
        context,
        type: 'network',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Add a listener for network errors
   * @param listener The listener function
   */
  addListener(listener: ErrorListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   * @param listener The listener to remove
   */
  removeListener(listener: ErrorListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of an error
   * @param error The error to notify about
   */
  private notifyListeners(error: Error): void {
    this.listeners.forEach(listener => listener(error));
  }

  /**
   * Set the modal open state
   * @param isOpen Whether the modal is open
   */
  setModalOpen(isOpen: boolean): void {
    this.isModalOpen = isOpen;
  }

  /**
   * Get the last error
   * @returns The last error or null if none
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Clear the last error
   */
  clearLastError(): void {
    this.lastError = null;
  }

  /**
   * Check if the error is a network error
   * @param error The error to check
   * @returns True if it's a network error
   */
  isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const errorMessage = error.message.toLowerCase();
    const networkErrorPatterns = [
      'network',
      'fetch failed',
      'networkerror',
      'failed to fetch',
      'connection',
      'timeout',
      'econnrefused',
      'cors',
      'socket',
      'dns',
      'unreachable',
      'proxy',
      'certificate',
      'ssl',
      'tls',
      'handshake',
      'connect',
      'request failed',
      'api.', // Often indicates API endpoint issues
      'http',
      'gateway',
      'firewall',
      'blocked',
      'access denied',
      'forbidden',
      'unauthorized',
      'rate limit',
      'too many requests',
      'cloudflare',
      'cloudfront',
      'cdn',
      'vpn',
      'proxy'
    ];

    // Check if any of the network error patterns are in the error message
    return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Format a network error message with helpful information
   * @param error The error to format
   * @returns A user-friendly error message
   */
  formatNetworkErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    // Common VPN guidance message
    const vpnGuidance = `

Location Restrictions
Some exchanges restrict access from certain countries. If you're in a restricted region, you'll need to use a VPN.

VPN Recommendation
Use a reliable VPN service to connect from a supported country. Make sure your VPN is active before retrying the connection.`;

    // Exchange-specific messages
    if (message.includes('binance')) {
      return `Network connection to Binance failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    if (message.includes('bitmart')) {
      return `Network connection to BitMart failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    if (message.includes('bybit')) {
      return `Network connection to Bybit failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    if (message.includes('okx')) {
      return `Network connection to OKX failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    if (message.includes('coinbase')) {
      return `Network connection to Coinbase failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    if (message.includes('kraken')) {
      return `Network connection to Kraken failed. Please check your internet connection or try using a VPN.${vpnGuidance}`;
    }

    // Error type-specific messages
    if (message.includes('timeout')) {
      return `Connection timed out. The exchange server might be experiencing high load or your internet connection is slow.`;
    }

    if (message.includes('cors')) {
      return `CORS error detected. This is likely an issue with the proxy server. Please ensure the proxy server is running.`;
    }

    if (message.includes('proxy')) {
      return `Proxy server connection failed. Please ensure the proxy server is running.`;
    }

    if (message.includes('certificate') || message.includes('ssl') || message.includes('tls')) {
      return `SSL/TLS certificate error. This might be due to network restrictions or a proxy issue.`;
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return `Rate limit exceeded. Please wait a few minutes before trying again.`;
    }

    if (message.includes('forbidden') || message.includes('unauthorized') || message.includes('access denied')) {
      return `Access denied by the exchange. This might be due to IP restrictions or invalid API credentials.`;
    }

    if (message.includes('firewall') || message.includes('blocked')) {
      return `Connection blocked by a firewall or network restriction. Try using a VPN or contact your network administrator.`;
    }

    // Default message
    return `Network connection to exchange failed. Please check your internet connection or try using a VPN.`;
  }
}

export const networkErrorHandler = NetworkErrorHandler.getInstance();
