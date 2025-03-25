import { logService } from './log-service';
import type { SupabaseError } from './supabase-types';

export class ErrorHandler {
  static isSupabaseError(error: any): error is SupabaseError {
    return error && typeof error === 'object' && 'code' in error;
  }

  static isNotFoundError(error: any): boolean {
    if (this.isSupabaseError(error)) {
      return error.code === 'PGRST116';
    }
    return false;
  }

  static handleDatabaseError(error: any, context: string): never {
    if (this.isSupabaseError(error)) {
      if (this.isNotFoundError(error)) {
        logService.log('warn', `Resource not found in ${context}`, error, 'ErrorHandler');
        throw new Error('Resource not found');
      }
      logService.log('error', `Database error in ${context}`, error, 'ErrorHandler');
      throw new Error('Database operation failed');
    }
    logService.log('error', `Unexpected error in ${context}`, error, 'ErrorHandler');
    throw error;
  }

  static handleNetworkError(error: any, context: string): never {
    logService.log('error', `Network error in ${context}`, error, 'ErrorHandler');
    throw new Error('Network error occurred');
  }

  static handleGeneralError(error: any, context: string): never {
    logService.log('error', `Error in ${context}`, error, 'ErrorHandler');
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}