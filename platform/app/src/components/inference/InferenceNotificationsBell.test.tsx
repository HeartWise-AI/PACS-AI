import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import InferenceNotificationsBell from './InferenceNotificationsBell';
import type { InferenceNotification } from './inferenceNotifications';
import { buildProcessingNotificationWorklistPath } from './processingNotificationNavigation';

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
    t: (key: string) => key,
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

  it('navigates to the exact study worklist deep link instead of the viewer', () => {
    const notificationButton = renderer.root
      .findAllByType('button')
      .find(button => button.props.className.includes('block w-full'));

    act(() => notificationButton?.props.onClick());

    expect(mockNavigate).toHaveBeenCalledWith(buildProcessingNotificationWorklistPath('study-1'));
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
});
