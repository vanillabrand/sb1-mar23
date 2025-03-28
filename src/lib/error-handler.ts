import { logService } from './log-service';

// Custom error classes should be defined before they're used
export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class UnexpectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnexpectedError';
  }
}

interface ErrorDetails {
  message: string;
  code?: string;
  details?: any;
}

export class ErrorHandler {
  static handleDatabaseError(error: unknown, context: string): never {
    const errorDetails = this.extractErrorDetails(error);

    if (this.isSupabaseError(error)) {
      if (this.isNotFoundError(error)) {
        logService.log('warn', `Resource not found in ${context}`, errorDetails, 'ErrorHandler');
        throw new ResourceNotFoundError(errorDetails.message);
      }
      if (this.isAuthenticationError(error)) {
        logService.log('error', `Authentication error in ${context}`, errorDetails, 'ErrorHandler');
        throw new AuthenticationError(errorDetails.message);
      }
      logService.log('error', `Database error in ${context}`, errorDetails, 'ErrorHandler');
      throw new DatabaseError(errorDetails.message);
    }

    logService.log('error', `Unexpected error in ${context}`, errorDetails, 'ErrorHandler');
    throw new UnexpectedError(errorDetails.message);
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

  private static extractErrorDetails(error: unknown): ErrorDetails {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
      };
    }
    return {
      message: String(error),
      code: undefined,
      details: undefined,
    };
  }
}
