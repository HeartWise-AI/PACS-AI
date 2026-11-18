import React from 'react';

/**
 * Error boundary around our route pages and the viewer layout template, so
 * their render errors stop here instead of reaching OHIF's route boundary
 * (which shows OHIF's red "Something went wrong" notification).
 *
 * A failed subtree is replaced by a short message with "Reload" and "Back to
 * studies". It used to be replaced by nothing: a render error in the viewer
 * layout (header included) left a blank page with no hint of what happened.
 * The error is written to the console with the component stack.
 *
 * Script errors and unhandled rejections outside React rendering don't reach
 * this boundary; they stay silent as before (see errors/routeErrorNotifications).
 */
type Props = {
  context: string;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message ? `${error.name}: ${error.message}` : error.name;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Unknown error';
}

export function PacsAiErrorFallback({
  context,
  error,
  onReload = () => window.location.reload(),
  onBackToStudies = () => window.location.assign('/'),
}: {
  context: string;
  error: unknown;
  onReload?: () => void;
  onBackToStudies?: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="pacs-ai-error-fallback"
      data-context={context}
      className="flex h-full min-h-screen w-full items-center justify-center bg-black p-6 text-white"
    >
      <div className="max-w-lg rounded-lg border border-gray-600 bg-[#2B2E2A] p-6">
        <h1 className="text-lg font-semibold">This page could not be displayed</h1>
        <p className="mt-2 text-sm text-white/80">
          Something went wrong while showing it. Reload the page. If it happens again, send a
          screenshot of this message to the PACS-AI team.
        </p>
        <p
          className="mt-3 break-words rounded bg-black/40 px-3 py-2 font-mono text-xs text-[#FFB199]"
          data-testid="pacs-ai-error-fallback-detail"
        >
          {describeError(error)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg bg-[#D1FF62] px-4 py-2 text-sm font-semibold text-black"
            data-testid="pacs-ai-error-fallback-reload"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={onBackToStudies}
            className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-white"
            data-testid="pacs-ai-error-fallback-studies"
          >
            Back to studies
          </button>
        </div>
      </div>
    </div>
  );
}

class PacsAiErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[PACS-AI] ${this.props.context} failed to render`, error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <PacsAiErrorFallback
          context={this.props.context}
          error={this.state.error}
        />
      );
    }
    return this.props.children;
  }
}

export default PacsAiErrorBoundary;
