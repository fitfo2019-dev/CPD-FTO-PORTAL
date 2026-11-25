import React, { type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null; attempt: number };

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Do not print exception details; component errors can contain user data.
  }

  private retry = (): void => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }));
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
          <section
            role="alert"
            className="mx-auto mt-16 max-w-lg rounded-xl border border-gray-200 bg-white p-7 shadow-sm"
          >
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Preview interrupted
            </div>
            <h1 className="text-2xl font-semibold">This view hit a problem</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              The rest of the preview is still available. Try loading this view
              again.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-5 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              Try again
            </button>
          </section>
        </main>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
