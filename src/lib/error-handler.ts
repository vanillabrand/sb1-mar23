import { logService } from './log-service';

export class ErrorHandler {
  static handleDatabaseError(error: any, context: string): never {
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      context
    };

    if (this.isSupabaseError(error)) {
      if (this.isNotFoundError(error)) {
        logService.log('warn', `Resource not found in ${context}`, errorDetails, 'ErrorHandler');
        throw new Error(`Resource not found: ${error.message}`);
      }
      if (this.isAuthenticationError(error)) {
        logService.log('error', `Authentication error in ${context}`, errorDetails, 'ErrorHandler');
        throw new Error('Authentication failed');
      }
      logService.log('error', `Database error in ${context}`, errorDetails, 'ErrorHandler');
      throw new Error(`Database operation failed: ${error.message}`);
    }
    logService.log('error', `Unexpected error in ${context}`, errorDetails, 'ErrorHandler');
    throw error;
  }

  static handleNetworkError(error: any, context: string): never {
    const errorDetails = {
      message: error?.message,
      code: error?.code,
      context
    };
    logService.log('error', `Network error in ${context}`, errorDetails, 'ErrorHandler');
    throw new Error(`Network error occurred: ${error.message}`);
  }

  static handleUnexpectedError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logService.log('error', `Unexpected error in ${context}`, { error, message: errorMessage }, 'ErrorHandler');
    throw new Error(`Unexpected error: ${errorMessage}`);
  }

  private static isSupabaseError(error: any): boolean {
    return error?.message?.includes('Supabase') || 
           error?.code?.startsWith('SUPABASE') ||
           error?.code?.startsWith('PGRST');
  }

  private static isNotFoundError(error: any): boolean {
    return error?.message?.includes('not found') || 
           error?.code === 'NOT_FOUND' ||
           error?.code === 'PGRST116';
  }

  private static isAuthenticationError(error: any): boolean {
    return error?.message?.includes('authentication') ||
           error?.code?.startsWith('AUTH') ||
           error?.code === 'PGRST301';
  }
}
