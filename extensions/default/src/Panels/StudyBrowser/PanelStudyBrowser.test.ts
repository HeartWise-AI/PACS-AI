import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useSystem } from '@ohif/core';
import { useImageViewer, useViewportGrid } from '@ohif/ui-next';
import PanelStudyBrowser from './PanelStudyBrowser';

jest.mock('@ohif/core', () => ({
  useSystem: jest.fn(),
  utils: {
    sortStudyInstances: jest.fn(),
    formatDate: jest.fn(date => date),
    createStudyBrowserTabs: jest.fn(() => []),
  },
}));

jest.mock('@ohif/ui-next', () => {
  const React = require('react');
  return {
    useImageViewer: jest.fn(),
    useViewportGrid: jest.fn(),
    StudyBrowser: () => React.createElement('div', { 'data-testid': 'study-browser' }),
    Separator: () => React.createElement('div'),
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => jest.fn()),
}));

jest.mock('./PanelStudyBrowserHeader', () => ({
  PanelStudyBrowserHeader: () => null,
}));

jest.mock('./constants', () => ({ defaultActionIcons: [] }));
jest.mock('../../Components/MoreDropdownMenu', () => jest.fn(() => null));

const mockedUseSystem = useSystem as jest.Mock;
const mockedUseImageViewer = useImageViewer as jest.Mock;
const mockedUseViewportGrid = useViewportGrid as jest.Mock;

describe('PanelStudyBrowser PACS-AI contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('eagerly requests display-set creation for every discovered study', async () => {
    const subscription = () => ({ unsubscribe: jest.fn() });
    const displaySetService = {
      activeDisplaySets: [],
      getActiveDisplaySets: jest.fn(() => []),
      subscribe: jest.fn(subscription),
      EVENTS: {
        DISPLAY_SETS_ADDED: 'DISPLAY_SETS_ADDED',
        DISPLAY_SETS_CHANGED: 'DISPLAY_SETS_CHANGED',
        DISPLAY_SET_SERIES_METADATA_INVALIDATED: 'DISPLAY_SET_SERIES_METADATA_INVALIDATED',
      },
    };
    const customizationService = {
      getCustomization: jest.fn(key => (key === 'studyBrowser.viewPresets' ? [] : undefined)),
    };
    mockedUseSystem.mockReturnValue({
      servicesManager: { services: { displaySetService, customizationService } },
      commandsManager: {},
      extensionManager: { _appConfig: {} },
    });
    mockedUseImageViewer.mockReturnValue({ StudyInstanceUIDs: ['primary-study'] });
    mockedUseViewportGrid.mockReturnValue([
      { activeViewportId: undefined, viewports: new Map(), isHangingProtocolLayout: false },
    ]);

    const discoveredStudies = [
      {
        studyInstanceUid: 'primary-study',
        date: '20240101',
        description: 'Primary',
        instances: 10,
        modalities: 'CT',
      },
      {
        studyInstanceUid: 'prior-study',
        date: '20230101',
        description: 'Prior',
        instances: 8,
        modalities: 'CT',
      },
    ];
    const dataSource = {
      query: { studies: { search: jest.fn().mockResolvedValue([discoveredStudies[0]]) } },
      getImageIdsForDisplaySet: jest.fn(() => []),
    };
    const requestDisplaySetCreationForStudy = jest.fn();

    await act(async () => {
      root.render(
        React.createElement(PanelStudyBrowser, {
          getImageSrc: jest.fn(),
          getStudiesForPatientByMRN: jest.fn().mockResolvedValue(discoveredStudies),
          requestDisplaySetCreationForStudy,
          dataSource,
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestDisplaySetCreationForStudy).toHaveBeenCalledTimes(2);
    expect(requestDisplaySetCreationForStudy).toHaveBeenCalledWith(
      displaySetService,
      'primary-study',
      true
    );
    expect(requestDisplaySetCreationForStudy).toHaveBeenCalledWith(
      displaySetService,
      'prior-study',
      true
    );
  });
});
