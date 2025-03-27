import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
          <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
          <p className="text-sm text-red-600">Please refresh the page or contact support</p>
        </div>
      );
    }

    return this.props.children;
  }
}
