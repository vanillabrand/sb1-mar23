export class EnvironmentValidator {
  private static readonly REQUIRED_VARS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_DEEPSEEK_API_KEY',
    'VITE_ENCRYPTION_KEY',
    'VITE_DEMO_EXCHANGE_API_KEY',
    'VITE_DEMO_EXCHANGE_SECRET',
    'VITE_DEMO_EXCHANGE_MEMO'
  ] as const;

  private static readonly URL_VARS = [
    'VITE_SUPABASE_URL'
  ] as const;

  static validate(): void {
    this.checkMissingVars();
    this.validateUrls();
    this.validateApiKeys();
  }

  private static checkMissingVars(): void {
    const missing = this.REQUIRED_VARS.filter(
      varName => !import.meta.env[varName]
    );

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }

  private static validateUrls(): void {
    this.URL_VARS.forEach(varName => {
      const url = import.meta.env[varName];
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid URL for ${varName}: ${url}`);
      }
    });
  }

  private static validateApiKeys(): void {
    const apiKeys = [
      'VITE_DEEPSEEK_API_KEY',
      'VITE_DEMO_EXCHANGE_API_KEY',
      'VITE_DEMO_EXCHANGE_SECRET'
    ];

    apiKeys.forEach(key => {
      const value = import.meta.env[key];
      if (typeof value !== 'string' || value.length < 10) {
        throw new Error(`Invalid API key format for ${key}`);
      }
    });
  }
}
