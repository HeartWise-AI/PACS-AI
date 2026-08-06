import { PROCESSING_RUN_OUTCOMES, PROCESSING_RUN_PHASES, PROCESSING_RUN_TRIGGERS } from './types';
import type { WorklistStudyStatusEventDTO } from './restDTO';

export const WORKLIST_STUDY_STATUS_EVENT = 'study_status.updated';

export interface ServerSentEventFrame {
  event: string;
  data: string;
}

export interface ServerSentEventParser {
  push(chunk: string): ServerSentEventFrame[];
  finish(): ServerSentEventFrame[];
  reset(): void;
}

export function createServerSentEventParser(): ServerSentEventParser {
  let bufferedText = '';
  let eventName = '';
  let dataLines: string[] = [];

  function dispatch(): ServerSentEventFrame[] {
    if (dataLines.length === 0) {
      eventName = '';
      return [];
    }

    const frame = {
      event: eventName || 'message',
      data: dataLines.join('\n'),
    };
    eventName = '';
    dataLines = [];
    return [frame];
  }

  function processLine(rawLine: string): ServerSentEventFrame[] {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line === '') {
      return dispatch();
    }

    if (line.startsWith(':')) {
      return [];
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (field === 'event') {
      eventName = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }

    return [];
  }

  function push(chunk: string): ServerSentEventFrame[] {
    bufferedText += chunk;
    const frames: ServerSentEventFrame[] = [];
    let newlineIndex = bufferedText.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = bufferedText.slice(0, newlineIndex);
      bufferedText = bufferedText.slice(newlineIndex + 1);
      frames.push(...processLine(line));
      newlineIndex = bufferedText.indexOf('\n');
    }

    return frames;
  }

  function finish(): ServerSentEventFrame[] {
    const frames = bufferedText ? processLine(bufferedText) : [];
    bufferedText = '';
    frames.push(...dispatch());
    return frames;
  }

  function reset() {
    bufferedText = '';
    eventName = '';
    dataLines = [];
  }

  return { push, finish, reset };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isAttentionReason(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    (value.message === undefined || isNullableString(value.message))
  );
}

function isWorklistStudyStatusEventDTO(value: unknown): value is WorklistStudyStatusEventDTO {
  if (!isRecord(value)) {
    return false;
  }

  const countFields = [
    'expectedModels',
    'pendingModels',
    'queuedModels',
    'runningModels',
    'completedModels',
    'failedModels',
    'skippedModels',
    'cancelledModels',
    'activeModels',
  ];

  return (
    value.type === WORKLIST_STUDY_STATUS_EVENT &&
    typeof value.studyInstanceUID === 'string' &&
    typeof value.runId === 'string' &&
    isPositiveInteger(value.runNumber) &&
    PROCESSING_RUN_TRIGGERS.includes(value.trigger as never) &&
    PROCESSING_RUN_PHASES.includes(value.phase as never) &&
    (value.outcome === null || PROCESSING_RUN_OUTCOMES.includes(value.outcome as never)) &&
    typeof value.attentionRequired === 'boolean' &&
    Array.isArray(value.attentionReasons) &&
    value.attentionReasons.every(isAttentionReason) &&
    countFields.every(field => isNonNegativeInteger(value[field])) &&
    isPositiveInteger(value.version) &&
    isNullableString(value.startedAt) &&
    isNullableString(value.completedAt) &&
    typeof value.updatedAt === 'string'
  );
}

export function parseWorklistStudyStatusEvent(
  frame: ServerSentEventFrame
): WorklistStudyStatusEventDTO | null {
  if (frame.event !== WORKLIST_STUDY_STATUS_EVENT) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(frame.data);
    return isWorklistStudyStatusEventDTO(payload) ? payload : null;
  } catch {
    return null;
  }
}
