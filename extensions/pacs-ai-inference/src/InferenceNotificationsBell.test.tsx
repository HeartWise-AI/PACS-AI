import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import InferenceNotificationsBell from './InferenceNotificationsBell';
import type { InferenceNotification } from '@pacs-ai/extension-core/src/inferenceProcessing/inferenceNotifications';
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
let renderer: RenderResult;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      [key, ...Object.values(options)].join('|'),
  }),
}));

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider', () => ({
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
    renderer = render(<InferenceNotificationsBell />);
  });

  afterEach(() => {
    renderer.unmount();
  });

  it('opens the study in the viewer', () => {
    const notificationButton = Array.from(renderer.container.querySelectorAll('button')).find(
      button => button.className.includes('block w-full')
    );

    expect(notificationButton).toBeDefined();
    act(() => {
      fireEvent.click(notificationButton as HTMLButtonElement);
    });

    // Through /open-study: retrieved from the PACS first when the cache no longer has it.
    expect(mockNavigate).toHaveBeenCalledWith('/open-study?StudyInstanceUIDs=study-1');
    expect(buildProcessingNotificationViewerPath('1.2.840/a b')).toBe(
      '/open-study?StudyInstanceUIDs=1.2.840%2Fa+b'
    );
    expect(mockInferenceProcessingContext.setBellOpen).toHaveBeenCalledWith(false);
  });

  it('preserves the existing mark-all-read behavior when the bell opens', () => {
    mockInferenceProcessingContext.isBellOpen = false;
    renderer.rerender(<InferenceNotificationsBell />);

    const bellButton = renderer.getByLabelText('ProcessingNotificationsAriaLabel');
    act(() => {
      fireEvent.click(bellButton);
    });

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
    renderer.rerender(<InferenceNotificationsBell />);

    const text = renderer.container.innerHTML;
    expect(text).toContain('ProcessingNotificationUnknownStudy');
    expect(text).toContain('ProcessingNotificationStudyReference|12345678');
    expect(text).not.toContain('ProcessingNotificationUnknownModality');
  });

  it('labels automatic analyses only', () => {
    expect(
      renderer.container.querySelectorAll('[data-testid="processing-notification-automatic"]')
    ).toHaveLength(0);

    mockInferenceProcessingContext.notifications = [
      notification,
      { ...notification, deduplicationKey: 'study-2:run-2:3:terminal', trigger: 'AUTO' },
    ];
    renderer.rerender(<InferenceNotificationsBell />);

    const labels = renderer.container.querySelectorAll(
      'span[data-testid="processing-notification-automatic"]'
    );
    expect(labels).toHaveLength(1);
    expect(labels[0].childNodes).toHaveLength(1);
    expect(labels[0].textContent).toBe('ProcessingNotificationAutomatic');
  });

  it('shows the patient and modalities once they are known', () => {
    const text = renderer.container.innerHTML;
    expect(text).toContain('Visible patient');
    expect(text).toContain('XA');
  });
});
