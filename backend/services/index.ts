
import { supabase } from '../lib/supabase-client.js';
import { logService } from '../../src/lib/log-service.js';

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastCheck: Date;
  error?: string;
}

class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, ServiceStatus> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  async initializeServices(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize database connection
      await this.checkDatabaseConnection();
      this.updateServiceStatus('database', 'running');

      // Initialize other core services
      await this.initializeCoreServices();

      this.initialized = true;
      console.log('All services initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize services:', errorMessage);
      throw error;
    }
  }

  private async checkDatabaseConnection(): Promise<void> {
    try {
      // First, check if we can connect to Supabase
      const { data, error } = await supabase
        .from('health_check')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Supabase connection error:', {
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Database connection failed: ${error.message}`);
      }

      // If we get here, connection is successful
      console.log('Successfully connected to Supabase');
      
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        throw new Error(`Database connection failed: ${error.message}`);
      } else {
        console.error('Unexpected error during database connection:', error);
        throw new Error('Database connection failed: Unexpected error');
      }
    }
  }

  private async initializeCoreServices(): Promise<void> {
    try {
      // Add initialization for other core services here
      this.updateServiceStatus('api', 'running');
      this.updateServiceStatus('websocket', 'running');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Core services initialization failed: ${errorMessage}`);
    }
  }

  private updateServiceStatus(serviceName: string, status: 'running' | 'stopped' | 'error', error?: string): void {
    this.services.set(serviceName, {
      name: serviceName,
      status,
      lastCheck: new Date(),
      error
    });
  }

  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.services.get(serviceName);
  }

  getAllServicesStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }
}

// Create and export the singleton instance
const serviceManager = ServiceManager.getInstance();

// Export the initialization function
export const initializeServices = async (): Promise<void> => {
  await serviceManager.initializeServices();
};

// Export the service manager instance
export { serviceManager };

