import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
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
    this.setState({ errorInfo });

    // Log to any monitoring service you might be using
    // Example: logService.log('error', 'Error boundary caught error', { error, errorInfo }, 'ErrorBoundary');
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      // If a fallback is provided, render it
      if (this.props.fallback) {
        return React.cloneElement(this.props.fallback, {
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          onReset: this.handleReset
        });
      }

      // Otherwise, render the default error UI
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-gunmetal-800 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-300 mb-4 text-center">
            There was an error loading this component. Please try refreshing the page.
          </p>

          {this.state.error && (
            <div className="bg-gunmetal-900 p-4 rounded-md w-full max-w-2xl mb-4 overflow-auto">
              <p className="text-red-400 font-mono text-sm mb-2">{this.state.error.toString()}</p>
              {this.state.errorInfo && (
                <pre className="text-gray-400 font-mono text-xs mt-2 max-h-40 overflow-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-4 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-gunmetal-700 text-white rounded-lg hover:bg-gunmetal-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
