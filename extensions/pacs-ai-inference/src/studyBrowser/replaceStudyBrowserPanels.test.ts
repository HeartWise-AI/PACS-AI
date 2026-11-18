import { replaceStudyBrowserPanels } from './replaceStudyBrowserPanels';

jest.mock('./PacsAiSeriesListPanel', () => ({
  __esModule: true,
  default: 'PacsAiSeriesListPanel',
}));
jest.mock('./PacsAiTrackedSeriesListPanel', () => ({
  __esModule: true,
  default: 'PacsAiTrackedSeriesListPanel',
}));

const DEFAULT_ID = '@ohif/extension-default.panelModule.seriesList';
const TRACKING_ID = '@ohif/extension-measurement-tracking.panelModule.seriesList';

function createExtensionManager(modulesMap: Record<string, any>) {
  const manager: any = { modulesMap };
  manager.getModuleEntry = id => manager.modulesMap[id];
  return manager;
}

describe('replaceStudyBrowserPanels', () => {
  it('gives the stock study browser panels our component and keeps their metadata', () => {
    const defaultEntry = {
      id: DEFAULT_ID,
      name: 'seriesList',
      label: 'Studies',
      component: 'Upstream',
    };
    const manager = createExtensionManager({ [DEFAULT_ID]: defaultEntry });

    replaceStudyBrowserPanels(manager);

    expect(manager.getModuleEntry(DEFAULT_ID)).toEqual({
      id: DEFAULT_ID,
      name: 'seriesList',
      label: 'Studies',
      component: 'PacsAiSeriesListPanel',
    });
  });

  it('replaces the tracking panel when that extension registers later', () => {
    const manager = createExtensionManager({});
    replaceStudyBrowserPanels(manager);

    expect(manager.getModuleEntry(TRACKING_ID)).toBeUndefined();

    manager.modulesMap[TRACKING_ID] = { id: TRACKING_ID, component: 'UpstreamTracking' };
    expect(manager.getModuleEntry(TRACKING_ID).component).toBe('PacsAiTrackedSeriesListPanel');
  });

  it('leaves other module entries alone and wraps only once', () => {
    const other = { id: 'x.panelModule.measure', component: 'Measure' };
    const manager = createExtensionManager({ [other.id]: other });

    replaceStudyBrowserPanels(manager);
    const wrapped = manager.getModuleEntry;
    replaceStudyBrowserPanels(manager);

    expect(manager.getModuleEntry).toBe(wrapped);
    expect(manager.getModuleEntry(other.id)).toBe(other);
    expect(other.component).toBe('Measure');
  });
});
