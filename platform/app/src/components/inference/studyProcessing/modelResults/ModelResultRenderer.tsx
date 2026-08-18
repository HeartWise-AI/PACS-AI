import React from 'react';
import type { ModelExecutionResult } from '../types';
import { GenericModelResult } from '../GenericModelResult';
import { CardioSyntaxResult } from './CardioSyntaxResult';
import { DeepCoroClipResult } from './DeepCoroClipResult';
import { EchoPrimeResult } from './EchoPrimeResult';
import { PanEchoResult } from './PanEchoResult';
import { UnsupportedModelResult } from './UnsupportedModelResult';
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

  if (resolved.kind === 'unsupported') {
    return (
      <UnsupportedModelResult
        modelName={resolved.modelName}
        modelVersion={resolved.modelVersion}
        payload={resolved.payload}
        reason={resolved.reason}
      />
    );
  }

  let customResult: React.ReactNode = genericFallback;
  switch (resolved.kind) {
    case 'cardiosyntax':
      customResult = <CardioSyntaxResult payload={resolved.payload} />;
      break;
    case 'deepcoro-clip':
      customResult = <DeepCoroClipResult payload={resolved.payload} />;
      break;
    case 'panecho':
      customResult = (
        <PanEchoResult
          payload={resolved.payload}
          modelName={result.modelName}
          modelVersion={result.modelVersion}
          status={result.status}
        />
      );
      break;
    case 'echoprime':
      customResult = (
        <EchoPrimeResult
          payload={resolved.payload}
          modelName={result.modelName}
          modelVersion={result.modelVersion}
          status={result.status}
        />
      );
      break;
  }

  const boundaryFallback =
    resolved.kind === 'panecho' || resolved.kind === 'echoprime' ? (
      <UnsupportedModelResult
        modelName={result.modelName}
        modelVersion={result.modelVersion}
        payload={result.result}
        reason="renderer"
      />
    ) : (
      genericFallback
    );

  return (
    <ModelResultRendererBoundary
      fallback={boundaryFallback}
      resetKey={JSON.stringify([result.runId, result.executionId])}
    >
      {customResult}
    </ModelResultRendererBoundary>
  );
}

export default ModelResultRenderer;
