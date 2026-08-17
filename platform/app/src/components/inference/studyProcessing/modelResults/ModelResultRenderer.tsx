import React from 'react';
import type { ModelExecutionResult } from '../types';
import { GenericModelResult } from '../GenericModelResult';
import { CardioSyntaxResult } from './CardioSyntaxResult';
import { DeepCoroClipResult } from './DeepCoroClipResult';
import { resolveModelResultRenderer } from './modelResultRendererRegistry';

interface ModelResultRendererBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  resetKey: string;
}

interface ModelResultRendererBoundaryState {
  failed: boolean;
}

export class ModelResultRendererBoundary extends React.Component<
  ModelResultRendererBoundaryProps,
  ModelResultRendererBoundaryState
> {
  state: ModelResultRendererBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelResultRendererBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previousProps: ModelResultRendererBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface ModelResultRendererProps {
  result: ModelExecutionResult;
}

export function ModelResultRenderer({ result }: ModelResultRendererProps) {
  const resolved = resolveModelResultRenderer(result);
  const genericFallback = <GenericModelResult value={result.result} />;

  if (resolved.kind === 'generic') {
    return genericFallback;
  }

  const customResult =
    resolved.kind === 'cardiosyntax' ? (
      <CardioSyntaxResult payload={resolved.payload} />
    ) : (
      <DeepCoroClipResult payload={resolved.payload} />
    );

  return (
    <ModelResultRendererBoundary
      fallback={genericFallback}
      resetKey={JSON.stringify([result.runId, result.executionId])}
    >
      {customResult}
    </ModelResultRendererBoundary>
  );
}

export default ModelResultRenderer;
