import React from 'react';
import type { ModelExecutionResult } from '@pacs-ai/extension-core/src/studyProcessing/types';
import { ReadableOrGenericModelResult } from '../ReadableModelResult';
import { CardioSyntaxResult } from './CardioSyntaxResult';
import { CathEfClipResult } from './CathEfClipResult';
import { CathEfResult } from './CathEfResult';
import { DeepCoroClipResult } from './DeepCoroClipResult';
import { DeepCoroCtoResult } from './DeepCoroCtoResult';
import { DeepCoroMaceResult } from './DeepCoroMaceResult';
import { DeepCoroSyntaxResult } from './DeepCoroSyntaxResult';
import { DeepRVClipResult } from './DeepRVClipResult';
import { DeepRVResult } from './DeepRVResult';
import { EchoAlignResult } from './EchoAlignResult';
import { EchoPrimeResult } from './EchoPrimeResult';
import { EchoSrResult } from './EchoSrResult';
import type { EchoSrResultPayload } from './echoSrContract';
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
  // Echo AI results (PanEcho, EchoAlign): the study's measured SR values, shown first in each
  // section of the structured report, and the DICOM PatientSex for sex-specific cut-offs.
  measured?: EchoSrResultPayload | null;
  patientSex?: string | null;
}

export function ModelResultRenderer({ result, measured = null, patientSex = null }: ModelResultRendererProps) {
  const resolved = resolveModelResultRenderer(result);
  // Flat data is shown as readable tables; the generic tree stays available.
  const genericFallback = <ReadableOrGenericModelResult value={result.result} />;

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
    case 'cathef-clip':
      customResult = <CathEfClipResult payload={resolved.payload} />;
      break;
    case 'cathef':
      customResult = <CathEfResult payload={resolved.payload} />;
      break;
    case 'deepcoro-clip':
      customResult = <DeepCoroClipResult payload={resolved.payload} />;
      break;
    case 'deepcoro-cto':
      customResult = <DeepCoroCtoResult payload={resolved.payload} />;
      break;
    case 'deepcoro-mace':
      customResult = <DeepCoroMaceResult payload={resolved.payload} />;
      break;
    case 'deepcoro-syntax':
      customResult = <DeepCoroSyntaxResult payload={resolved.payload} />;
      break;
    case 'deeprv-clip':
      customResult = <DeepRVClipResult payload={resolved.payload} />;
      break;
    case 'deeprv':
      customResult = <DeepRVResult payload={resolved.payload} />;
      break;
    case 'panecho':
      customResult = (
        <PanEchoResult
          payload={resolved.payload}
          modelName={result.modelName}
          modelVersion={result.modelVersion}
          status={result.status}
          measured={measured}
          patientSex={patientSex}
        />
      );
      break;
    case 'echoalign':
      customResult = (
        <EchoAlignResult
          payload={resolved.payload}
          modelName={result.modelName}
          modelVersion={result.modelVersion}
          status={result.status}
          measured={measured}
          patientSex={patientSex}
        />
      );
      break;
    case 'echo-sr':
      customResult = (
        <EchoSrResult
          payload={resolved.payload}
          modelVersion={result.modelVersion}
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
    resolved.kind === 'panecho' || resolved.kind === 'echoprime' || resolved.kind === 'echoalign' ? (
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
