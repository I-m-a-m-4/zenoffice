'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logErrorToFirestore } from '@/lib/error-logger';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    // Use the error-logger we just created
    logErrorToFirestore(error, 'react').catch(console.error);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center h-full w-full bg-background rounded-lg border border-dashed m-4">
          <div className="bg-destructive/10 p-4 rounded-full mb-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            We've automatically logged this issue and our team will investigate it. 
            Please try refreshing the page or navigating back.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
