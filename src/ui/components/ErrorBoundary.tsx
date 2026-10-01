import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 m-4 bg-red-50 border border-red-200 rounded text-red-800 font-mono text-sm overflow-auto h-full w-full">
          <h2 className="text-xl font-bold mb-4">Canvas Crashed</h2>
          <p className="mb-4">An error occurred while rendering the canvas.</p>
          <div className="bg-white p-4 rounded border border-red-100 shadow-inner mb-4">
            <h3 className="font-bold">Error:</h3>
            <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          </div>
          <div className="bg-white p-4 rounded border border-red-100 shadow-inner">
            <h3 className="font-bold">Component Stack:</h3>
            <pre className="whitespace-pre-wrap text-xs">{this.state.errorInfo?.componentStack}</pre>
          </div>
          <button 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            onClick={() => {
              // Attempt to recover by resetting state
              this.setState({ hasError: false, error: null, errorInfo: null });
            }}
          >
            Try to Recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
