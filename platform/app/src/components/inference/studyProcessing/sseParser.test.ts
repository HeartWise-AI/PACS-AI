import type { WorklistStudyStatusEventDTO } from './restDTO';
import {
  createServerSentEventParser,
  parseWorklistStudyStatusEvent,
  WORKLIST_STUDY_STATUS_EVENT,
} from './sseParser';

const eventPayload: WorklistStudyStatusEventDTO = {
  type: WORKLIST_STUDY_STATUS_EVENT,
  studyInstanceUID: '1.2.840.113619.2.55.3.604688433.123',
  runId: 'run-3',
  runNumber: 3,
  trigger: 'AUTO',
  phase: 'PROCESSING',
  outcome: null,
  attentionRequired: true,
  attentionReasons: [
    {
      code: 'FUTURE_ATTENTION_REASON',
      message: 'A readable backend explanation',
    },
  ],
  expectedModels: 5,
  pendingModels: 1,
  queuedModels: 1,
  runningModels: 1,
  completedModels: 2,
  failedModels: 0,
  skippedModels: 0,
  cancelledModels: 0,
  activeModels: 3,
  version: 8,
  startedAt: '2026-08-06T14:30:00Z',
  completedAt: null,
  updatedAt: '2026-08-06T14:31:00Z',
};

function encodeEvent(payload: unknown = eventPayload, lineEnding = '\n') {
  return [`event: ${WORKLIST_STUDY_STATUS_EVENT}`, `data: ${JSON.stringify(payload)}`, '', ''].join(
    lineEnding
  );
}

describe('server-sent event parser', () => {
  it('parses and validates a complete study status event', () => {
    const parser = createServerSentEventParser();

    const frames = parser.push(encodeEvent());

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('preserves an event split across arbitrary network chunks', () => {
    const parser = createServerSentEventParser();
    const encodedEvent = encodeEvent();
    const chunks = [
      encodedEvent.slice(0, 5),
      encodedEvent.slice(5, 37),
      encodedEvent.slice(37, 113),
      encodedEvent.slice(113),
    ];

    const frames = chunks.flatMap(chunk => parser.push(chunk));

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('ignores connection and heartbeat comments', () => {
    const parser = createServerSentEventParser();

    expect(parser.push(': connected\n\n')).toEqual([]);
    expect(parser.push(': heartbeat\n\n')).toEqual([]);
  });

  it('accepts CRLF line endings', () => {
    const parser = createServerSentEventParser();

    const frames = parser.push(encodeEvent(eventPayload, '\r\n'));

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('joins multiline data fields before parsing JSON', () => {
    const parser = createServerSentEventParser();
    const multilineData = JSON.stringify(eventPayload, null, 2)
      .split('\n')
      .map(line => `data: ${line}`)
      .join('\n');

    const frames = parser.push(`event: ${WORKLIST_STUDY_STATUS_EVENT}\n${multilineData}\n\n`);

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('ignores unknown SSE fields without changing the event', () => {
    const parser = createServerSentEventParser();
    const encodedEvent = encodeEvent().replace(
      'data:',
      'id: ignored-by-this-ephemeral-stream\nretry: 1000\ndata:'
    );

    const frames = parser.push(encodedEvent);

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('does not treat another named event as a study status update', () => {
    const parser = createServerSentEventParser();
    const frames = parser.push(`event: future.event\ndata: ${JSON.stringify(eventPayload)}\n\n`);

    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toBeNull();
  });

  it('rejects malformed JSON without throwing', () => {
    const parser = createServerSentEventParser();
    const frames = parser.push(`event: ${WORKLIST_STUDY_STATUS_EVENT}\ndata: {broken\n\n`);

    expect(() => parseWorklistStudyStatusEvent(frames[0])).not.toThrow();
    expect(parseWorklistStudyStatusEvent(frames[0])).toBeNull();
  });

  it.each([
    ['a missing required field', { ...eventPayload, runId: undefined }],
    ['a zero run number', { ...eventPayload, runNumber: 0 }],
    ['a zero version', { ...eventPayload, version: 0 }],
    ['a negative model count', { ...eventPayload, failedModels: -1 }],
    ['an unsupported phase', { ...eventPayload, phase: 'STARTING' }],
    [
      'an invalid attention reason',
      { ...eventPayload, attentionReasons: [{ code: 42, message: null }] },
    ],
  ])('rejects %s', (_description, invalidPayload) => {
    const parser = createServerSentEventParser();
    const frames = parser.push(encodeEvent(invalidPayload));

    expect(parseWorklistStudyStatusEvent(frames[0])).toBeNull();
  });

  it('dispatches a final event when the stream ends without a blank line', () => {
    const parser = createServerSentEventParser();
    const incompleteTerminator = encodeEvent().replace(/\n\n$/, '');

    expect(parser.push(incompleteTerminator)).toEqual([]);

    const frames = parser.finish();
    expect(frames).toHaveLength(1);
    expect(parseWorklistStudyStatusEvent(frames[0])).toEqual(eventPayload);
  });

  it('clears buffered data when reset', () => {
    const parser = createServerSentEventParser();

    parser.push(`event: ${WORKLIST_STUDY_STATUS_EVENT}\ndata: `);
    parser.reset();

    expect(parser.finish()).toEqual([]);
    expect(parser.push(encodeEvent())).toHaveLength(1);
  });
});
