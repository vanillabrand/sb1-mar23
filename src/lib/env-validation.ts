/**
 * Environment Variable Validation Service
 * Validates that all required API keys and configuration are properly loaded
 */

import { logService } from './log-service';

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  invalidVars: string[];
  warnings: string[];
}

export class EnvValidation {
  private static readonly REQUIRED_VARS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_DEEPSEEK_API_KEY',
    'VITE_ENCRYPTION_KEY'
  ] as const;

  private static readonly OPTIONAL_VARS = [
    'VITE_NEWS_API_KEY',
    'VITE_NEWS_API_URL',
    'VITE_DEMO_EXCHANGE_API_KEY',
    'VITE_DEMO_EXCHANGE_SECRET',
    'VITE_DEMO_EXCHANGE_MEMO',
    'VITE_BINANCE_TESTNET_API_KEY',
    'VITE_BINANCE_TESTNET_API_SECRET',
    'VITE_BINANCE_FUTURES_TESTNET_API_KEY',
    'VITE_BINANCE_FUTURES_TESTNET_API_SECRET'
  ] as const;

  private static readonly URL_VARS = [
    'VITE_SUPABASE_URL',
    'VITE_NEWS_API_URL'
  ] as const;

  /**
   * Validate all environment variables
   */
  static validate(): EnvValidationResult {
    const result: EnvValidationResult = {
      isValid: true,
      missingVars: [],
      invalidVars: [],
      warnings: []
    };

    // Check required variables
    this.REQUIRED_VARS.forEach(varName => {
      const value = import.meta.env[varName];
      if (!value) {
        result.missingVars.push(varName);
        result.isValid = false;
      } else if (this.isInvalidValue(value)) {
        result.invalidVars.push(varName);
        result.isValid = false;
      }
    });

    // Check optional variables and warn if missing
    this.OPTIONAL_VARS.forEach(varName => {
      const value = import.meta.env[varName];
      if (!value) {
        result.warnings.push(`Optional variable ${varName} is not set`);
      } else if (this.isInvalidValue(value)) {
        result.warnings.push(`Optional variable ${varName} has invalid value`);
      }
    });

    // Validate URLs
    this.URL_VARS.forEach(varName => {
      const value = import.meta.env[varName];
      if (value && !this.isValidUrl(value)) {
        result.invalidVars.push(`${varName} (invalid URL format)`);
        result.isValid = false;
      }
    });

    // Validate API key formats
    this.validateApiKeyFormats(result);

    return result;
  }

  /**
   * Check if a value is invalid (placeholder or too short)
   */
  private static isInvalidValue(value: string): boolean {
    const placeholders = [
      'your_api_key',
      'your_supabase_url',
      'your_supabase_key',
      'example-key',
      'placeholder'
    ];

    return (
      placeholders.some(placeholder => value.toLowerCase().includes(placeholder)) ||
      value.length < 10
    );
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate specific API key formats
   */
  private static validateApiKeyFormats(result: EnvValidationResult): void {
    // Validate DeepSeek API key format
    const deepseekKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (deepseekKey && !deepseekKey.startsWith('sk-')) {
      result.warnings.push('VITE_DEEPSEEK_API_KEY should start with "sk-"');
    }

    // Validate Supabase URL format
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
      result.warnings.push('VITE_SUPABASE_URL should be a valid Supabase URL');
    }

    // Validate encryption key format (should be base64)
    const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY;
    if (encryptionKey) {
      try {
        // Remove quotes if present
        const cleanKey = encryptionKey.replace(/['"]/g, '');
        atob(cleanKey);
      } catch {
        result.warnings.push('VITE_ENCRYPTION_KEY should be a valid base64 string');
      }
    }
  }

  /**
   * Log validation results
   */
  static logValidationResults(result: EnvValidationResult): void {
    if (result.isValid) {
      logService.log('info', 'Environment validation passed', null, 'EnvValidation');
    } else {
      logService.log('error', 'Environment validation failed', {
        missingVars: result.missingVars,
        invalidVars: result.invalidVars
      }, 'EnvValidation');
    }

    if (result.warnings.length > 0) {
      logService.log('warn', 'Environment validation warnings', {
        warnings: result.warnings
      }, 'EnvValidation');
    }
  }

  /**
   * Get current environment configuration summary
   */
  static getConfigSummary(): Record<string, any> {
    return {
      // Core configuration
      supabaseConfigured: !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      deepseekConfigured: !!import.meta.env.VITE_DEEPSEEK_API_KEY,
      encryptionConfigured: !!import.meta.env.VITE_ENCRYPTION_KEY,
      
      // Optional services
      newsApiConfigured: !!import.meta.env.VITE_NEWS_API_KEY,
      demoExchangeConfigured: !!import.meta.env.VITE_DEMO_EXCHANGE_API_KEY,
      binanceTestnetConfigured: !!import.meta.env.VITE_BINANCE_TESTNET_API_KEY,
      
      // Performance flags
      fastInit: import.meta.env.VITE_FAST_INIT === 'true',
      lazyLoadServices: import.meta.env.VITE_LAZY_LOAD_SERVICES === 'true',
      demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
      
      // Environment info
      nodeEnv: import.meta.env.MODE,
      isDevelopment: import.meta.env.DEV,
      isProduction: import.meta.env.PROD
    };
  }

  /**
   * Validate and initialize environment
   */
  static validateAndInitialize(): boolean {
    const result = this.validate();
    this.logValidationResults(result);
    
    const summary = this.getConfigSummary();
    logService.log('info', 'Environment configuration summary', summary, 'EnvValidation');
    
    return result.isValid;
  }
}

// Export singleton instance
export const envValidation = EnvValidation;
