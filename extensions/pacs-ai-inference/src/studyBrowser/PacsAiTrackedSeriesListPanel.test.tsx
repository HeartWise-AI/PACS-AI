/**
 * Smoke render of the tracked study browser panel: PacsAiTrackedSeriesListPanel
 * -> PacsAiPanelStudyBrowser -> PacsAiStudyBrowser -> PacsAiStudyItem ->
 * PacsAiThumbnailList -> PacsAiThumbnail, with two display sets, one of them a
 * selected view of the open AI result. The system context and
 * createStudyBrowserTabs are OHIF's own (from @ohif/core sources); ui-next
 * primitives are stubbed.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { pacsAiStudyContextService } from '@pacs-ai/extension-core/src/services/PacsAiStudyContextService';
import PacsAiTrackedSeriesListPanel, {
  TRACKED_MEASUREMENTS_CONTEXT_ID,
} from './PacsAiTrackedSeriesListPanel';

jest.mock(
  '@ohif/core',
  () => {
    const system = jest.requireActual('@ohif/core/src/contextProviders/SystemProvider');
    const { createStudyBrowserTabs } = jest.requireActual(
      '@ohif/core/src/utils/createStudyBrowserTabs'
    );
    const { thumbnailNoImageModalities } = jest.requireActual(
      '@ohif/core/src/utils/thumbnailNoImageModalities'
    );
    return {
      useSystem: system.useSystem,
      SystemContextProvider: system.SystemContextProvider,
      utils: {
        createStudyBrowserTabs,
        thumbnailNoImageModalities,
        formatDate: (date: string) => date,
        sortStudyInstances: jest.fn(),
      },
    };
  },
  { virtual: true }
);

jest.mock(
  '@ohif/ui-next',
  () => {
    const Pass = ({ children }) => <>{children}</>;
    const Div = ({ children }) => <div>{children}</div>;
    // Stable values, as the real providers keep them between renders.
    const imageViewer = { StudyInstanceUIDs: ['study-1'] };
    const viewportGrid = [
      {
        activeViewportId: 'vp-1',
        viewports: new Map([['vp-1', { displaySetInstanceUIDs: ['ds-1'] }]]),
        isHangingProtocolLayout: false,
      },
    ];
    return {
      useImageViewer: () => imageViewer,
      useViewportGrid: () => viewportGrid,
      useDynamicMaxHeight: () => ({ ref: null, maxHeight: 0 }),
      Separator: () => null,
      ScrollArea: Div,
      StudyBrowserSort: () => null,
      StudyBrowserViewOptions: () => null,
      Accordion: Div,
      AccordionItem: Div,
      AccordionTrigger: Div,
      AccordionContent: Div,
      Tooltip: Pass,
      TooltipTrigger: Pass,
      TooltipContent: () => null,
      ToggleGroup: Div,
      ToggleGroupItem: Div,
      DisplaySetMessageListTooltip: () => null,
      FooterAction: Div,
      Icons: new Proxy({}, { get: () => () => null }),
    };
  }
  // Not virtual: @ohif/ui-next resolves (package exports). A virtual mock of a
  // resolvable module leaks into later suites of the same jest worker, which
  // then load the real ui-next instead of their own mock.
);

jest.mock(
  '@ohif/extension-default',
  () => ({
    MoreDropdownMenu: () => () => null,
    getStudiesForPatientByMRN: (_dataSource, qido) => Promise.resolve(qido),
    requestDisplaySetCreationForStudy: jest.fn(),
  }),
  { virtual: true }
);

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-dnd', () => ({ useDrag: () => [{}, () => {}, () => {}] }));
jest.mock('../studyRefresh/ViewerStudyRefresh', () => ({
  ViewerStudyRefresh: () => <span data-testid="viewer-study-refresh" />,
}));
jest.mock('../viewerResults/ViewerModelResultsProvider', () => {
  const viewerResults = {
    openedResult: {
      minimized: false,
      result: {
        modelName: 'Test model',
        selectedViews: [
          {
            sopInstanceUID: null,
            seriesInstanceUID: 'series-2',
            viewLabel: 'RAO',
            order: 1,
            role: null,
            extra: null,
          },
        ],
      },
    },
    setResultMinimized: jest.fn(),
    closeResult: jest.fn(),
  };
  return { useViewerModelResults: () => viewerResults };
});

const { SystemContextProvider } = jest.requireMock('@ohif/core');
const {
  sortingCriteria: { seriesSortCriteria },
} = jest.requireActual('@ohif/core/src/utils/sortStudy');

function displaySet(n: number) {
  return {
    displaySetInstanceUID: `ds-${n}`,
    StudyInstanceUID: 'study-1',
    SeriesInstanceUID: `series-${n}`,
    SeriesDescription: `Run ${n}`,
    SeriesNumber: n,
    Modality: 'XA',
    numImageFrames: 30,
    thumbnailSrc: `data:image/png;base64,${n}`,
  };
}

function renderPanel() {
  const displaySets = [displaySet(1), displaySet(2)];
  const dataSource = {
    query: {
      studies: {
        search: jest.fn(async () => [
          {
            studyInstanceUid: 'study-1',
            date: '20240101',
            description: 'Coronary angiography',
            modalities: 'XA',
            instances: 2,
            mrn: 'patient-1',
          },
        ]),
      },
    },
    getImageIdsForDisplaySet: () => [],
  };
  const TrackedMeasurementsContext = React.createContext(null);
  const extensionManager = {
    appConfig: {},
    getActiveDataSource: () => [dataSource],
    getModuleEntry: (id: string) => {
      if (id === TRACKED_MEASUREMENTS_CONTEXT_ID) {
        return { context: TrackedMeasurementsContext };
      }
      if (id === '@ohif/extension-cornerstone.utilityModule.common') {
        return { exports: { getCornerstoneLibraries: () => ({ cornerstone: {} }) } };
      }
      return undefined;
    },
  };
  const subscription = () => ({ unsubscribe: () => {} });
  const servicesManager = {
    services: {
      displaySetService: {
        activeDisplaySets: displaySets,
        getActiveDisplaySets: () => displaySets,
        getDisplaySetByUID: uid => displaySets.find(ds => ds.displaySetInstanceUID === uid),
        subscribe: subscription,
        EVENTS: {},
      },
      customizationService: {
        getCustomization: key => {
          if (key === 'studyBrowser.viewPresets') {
            return [
              { id: 'list', iconName: 'ListView', selected: false },
              { id: 'thumbnails', iconName: 'ThumbnailView', selected: true },
            ];
          }
          // Since 3.13, createStudyBrowserTabs sorts each study's display sets
          // with this customization (@ohif/extension-default registers it).
          if (key === 'sortingCriteria') {
            return seriesSortCriteria.seriesInfoSortingCriteria;
          }
          return undefined;
        },
      },
      viewportGridService: {
        subscribe: subscription,
        EVENTS: {},
        getActiveViewportId: () => 'vp-1',
      },
      uiModalService: { show: jest.fn() },
      measurementService: { getMeasurements: () => [], remove: jest.fn() },
    },
  };

  return render(
    <SystemContextProvider
      servicesManager={servicesManager}
      extensionManager={extensionManager}
      commandsManager={{}}
    >
      <TrackedMeasurementsContext.Provider
        value={[{ context: { trackedSeries: ['series-1'] } }, jest.fn()]}
      >
        <PacsAiTrackedSeriesListPanel />
      </TrackedMeasurementsContext.Provider>
    </SystemContextProvider>
  );
}

describe('PacsAiTrackedSeriesListPanel (smoke)', () => {
  it('renders the study, its thumbnails, the selected-view badge, legend and refresh', async () => {
    const { container, getByTestId } = renderPanel();

    await waitFor(() =>
      expect(container.querySelectorAll('[data-cy="study-browser-thumbnail"]')).toHaveLength(2)
    );

    expect(container.querySelector('[data-cy="studyBrowser-panel"]')).not.toBeNull();
    expect(container.textContent).toContain('Coronary angiography');

    const badges = container.querySelectorAll('[data-cy="thumbnail-selected-view-badge"]');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('1');
    expect(badges[0].closest('#thumbnail-ds-2')).not.toBeNull();

    expect(getByTestId('selected-views-legend')).toBeTruthy();
    expect(getByTestId('viewer-study-refresh')).toBeTruthy();

    // The study context gets the tab's display sets with their SeriesInstanceUID.
    await waitFor(() =>
      expect(pacsAiStudyContextService.getState().displaySets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ displaySetInstanceUID: 'ds-1', SeriesInstanceUID: 'series-1' }),
          expect.objectContaining({ displaySetInstanceUID: 'ds-2', SeriesInstanceUID: 'series-2' }),
        ])
      )
    );
  });
});
