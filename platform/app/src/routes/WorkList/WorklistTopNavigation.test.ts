import React from 'react';
import { render, screen } from '@testing-library/react';
import WorklistTopNavigation from './WorklistTopNavigation';

const mockTopNavigationProps = jest.fn();
const mockUseStudyProcessing = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { defaultValue?: string }) => values?.defaultValue ?? key,
  }),
}));

jest.mock('../../components/TopNavigation', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    __esModule: true,
    default: props => {
      mockTopNavigationProps(props);
      return React.createElement('header', null, props.accessory);
    },
  };
});

jest.mock('../../components/inference/studyProcessing', () => ({
  useStudyProcessing: () => mockUseStudyProcessing(),
}));

describe('WorklistTopNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStudyProcessing.mockReturnValue({ realtimeConnectionStatus: 'connected' });
  });

  test('always delegates identity and navigation behavior to the shared top bar', () => {
    render(React.createElement(WorklistTopNavigation, { fixturePreview: false }));

    expect(mockTopNavigationProps).toHaveBeenCalledTimes(1);
    expect(mockTopNavigationProps.mock.calls[0][0]).toMatchObject({
      title: 'Studies',
      accessory: undefined,
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('keeps the fixture connection indicator as a top-bar accessory', () => {
    render(React.createElement(WorklistTopNavigation, { fixturePreview: true }));

    expect(screen.getByRole('status').textContent).toContain('Fixture data connected');
    expect(screen.getByText('realtimeWorklist')).not.toBeNull();
  });
});
