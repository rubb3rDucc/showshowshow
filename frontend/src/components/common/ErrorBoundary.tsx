import { Component, type ReactNode } from 'react';
import { Button, Stack, Text, Title, Card } from '@mantine/core';
import { captureException } from '../../lib/posthog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components
 * Prevents entire app from crashing and displays a user-friendly error message
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send to PostHog for error tracking
    captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
      extra: {
        errorBoundary: true,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
          <Card
            className="max-w-md w-full"
            padding="xl"
            radius="md"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <Stack gap="md" align="center">
              <Title order={3} className="text-white">
                Something went wrong
              </Title>
              <Text size="sm" c="dimmed" ta="center">
                An unexpected error occurred. Try refreshing the page or click retry below.
              </Text>
              {import.meta.env.DEV && this.state.error && (
                <Text size="xs" c="red" className="font-mono break-all">
                  {this.state.error.message}
                </Text>
              )}
              <div className="flex gap-3 mt-2">
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={this.handleRetry}
                >
                  Try Again
                </Button>
                <Button
                  variant="filled"
                  color="gray"
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
              </div>
            </Stack>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
