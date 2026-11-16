import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import InferenceNotificationsBell from './InferenceNotificationsBell';
import type { InferenceNotification } from './inferenceNotifications';
import { buildProcessingNotificationViewerPath } from './processingNotificationNavigation';

const mockNavigate = jest.fn();
let mockInferenceProcessingContext: {
  notifications: InferenceNotification[];
  unreadCount: number;
  canShowBell: boolean;
  markAllRead: jest.Mock;
  isBellOpen: boolean;
  setBellOpen: jest.Mock;
};
let renderer: ReactTestRenderer;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      [key, ...Object.values(options)].join('|'),
  }),
}));

jest.mock('./InferenceProcessingProvider', () => ({
  useInferenceProcessing: () => mockInferenceProcessingContext,
}));

const notification: InferenceNotification = {
  attentionReasons: [],
  deduplicationKey: 'study-1:run-1:7:terminal',
  kind: 'terminal',
  modalitiesInStudy: 'XA',
  occurredAt: '2026-08-07T12:00:00Z',
  outcome: 'SUCCESS',
  patientName: 'Visible patient',
  read: false,
  runId: 'run-1',
  runNumber: 1,
  seenAt: 1000,
  source: 'study-event',
  studyInstanceUID: 'study-1',
  trigger: 'MANUAL_REPROCESS',
  version: 7,
};

describe('InferenceNotificationsBell', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockInferenceProcessingContext = {
      notifications: [notification],
      unreadCount: 1,
      canShowBell: true,
      markAllRead: jest.fn(),
      isBellOpen: true,
      setBellOpen: jest.fn(),
    };
    act(() => {
      renderer = TestRenderer.create(<InferenceNotificationsBell />);
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('opens the study in the viewer', () => {
    const notificationButton = renderer.root
      .findAllByType('button')
      .find(button => button.props.className.includes('block w-full'));

    act(() => notificationButton?.props.onClick());

    expect(mockNavigate).toHaveBeenCalledWith('/viewer?StudyInstanceUIDs=study-1');
    expect(buildProcessingNotificationViewerPath('1.2.840/a b')).toBe(
      '/viewer?StudyInstanceUIDs=1.2.840%2Fa%20b'
    );
    expect(mockInferenceProcessingContext.setBellOpen).toHaveBeenCalledWith(false);
  });

  it('preserves the existing mark-all-read behavior when the bell opens', () => {
    mockInferenceProcessingContext.isBellOpen = false;
    act(() => {
      renderer.update(<InferenceNotificationsBell />);
    });

    const bellButton = renderer.root.findByProps({
      'aria-label': 'ProcessingNotificationsAriaLabel',
    });
    act(() => bellButton.props.onClick());

    expect(mockInferenceProcessingContext.markAllRead).toHaveBeenCalledTimes(1);
    expect(mockInferenceProcessingContext.setBellOpen).toHaveBeenCalledWith(true);
  });

  it('identifies a study that could not be resolved instead of a missing modality', () => {
    mockInferenceProcessingContext.notifications = [
      {
        ...notification,
        patientName: null,
        modalitiesInStudy: null,
        studyInstanceUID: '1.2.826.0.1.3680043.8.498.12345678',
      },
    ];
    act(() => {
      renderer.update(<InferenceNotificationsBell />);
    });

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('ProcessingNotificationUnknownStudy');
    expect(text).toContain('ProcessingNotificationStudyReference|12345678');
    expect(text).not.toContain('ProcessingNotificationUnknownModality');
  });

  it('labels automatic analyses only', () => {
    expect(
      renderer.root.findAll(
        node => node.props['data-testid'] === 'processing-notification-automatic'
      )
    ).toHaveLength(0);

    mockInferenceProcessingContext.notifications = [
      notification,
      { ...notification, deduplicationKey: 'study-2:run-2:3:terminal', trigger: 'AUTO' },
    ];
    act(() => {
      renderer.update(<InferenceNotificationsBell />);
    });

    const labels = renderer.root.findAll(
      node =>
        node.type === 'span' && node.props['data-testid'] === 'processing-notification-automatic'
    );
    expect(labels).toHaveLength(1);
    expect(labels[0].children).toEqual(['ProcessingNotificationAutomatic']);
  });

  it('shows the patient and modalities once they are known', () => {
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Visible patient');
    expect(text).toContain('XA');
  });
});
