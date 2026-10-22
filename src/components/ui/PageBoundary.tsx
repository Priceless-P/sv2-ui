import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'wouter';

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
}

class PageErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="p-6">
          <p>Couldn't load this page.</p>
          <button type="button" className="mt-3 underline" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Keep the surrounding providers and dashboard mounted while a new page downloads. */
export function PageBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <PageErrorBoundary resetKey={location}>
      <Suspense fallback={<p role="status" className="p-6">Loading page…</p>}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}
