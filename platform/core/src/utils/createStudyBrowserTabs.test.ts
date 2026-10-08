import { useSystem } from '../contextProviders/SystemProvider';
import { createStudyBrowserTabs } from './createStudyBrowserTabs';

jest.mock('../contextProviders/SystemProvider', () => ({
  useSystem: jest.fn(),
}));

const mockedUseSystem = useSystem as jest.Mock;

function mockStudyBrowserServices(activeDisplaySets) {
  const displaySetService = {
    activeDisplaySets,
    getDisplaySetByUID: jest.fn(displaySetInstanceUID =>
      activeDisplaySets.find(
        displaySet => displaySet.displaySetInstanceUID === displaySetInstanceUID
      )
    ),
  };
  const customizationService = {
    getCustomization: jest.fn(() => () => 0),
  };
  mockedUseSystem.mockReturnValue({
    servicesManager: { services: { displaySetService, customizationService } },
  });
}

describe('createStudyBrowserTabs PACS-AI contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds the active SeriesInstanceUID to matching thumbnail display sets', () => {
    mockStudyBrowserServices([
      {
        displaySetInstanceUID: 'display-set-1',
        SeriesInstanceUID: 'series-1',
      },
    ]);

    const thumbnailDisplaySet = {
      displaySetInstanceUID: 'display-set-1',
      StudyInstanceUID: 'study-1',
      description: 'CT series',
    };
    const tabs = createStudyBrowserTabs(
      ['study-1'],
      [{ studyInstanceUid: 'study-1', date: '2024-01-01' }],
      [thumbnailDisplaySet]
    );

    expect(tabs.find(tab => tab.name === 'primary').studies[0].displaySets[0]).toEqual({
      ...thumbnailDisplaySet,
      SeriesInstanceUID: 'series-1',
    });
    expect(thumbnailDisplaySet).not.toHaveProperty('SeriesInstanceUID');
  });

  it('leaves display sets unchanged when there is no matching active display set', () => {
    mockStudyBrowserServices([
      {
        displaySetInstanceUID: 'another-display-set',
        SeriesInstanceUID: 'another-series',
      },
    ]);

    const thumbnailDisplaySet = {
      displaySetInstanceUID: 'display-set-1',
      StudyInstanceUID: 'study-1',
    };
    const tabs = createStudyBrowserTabs(
      ['study-1'],
      [{ studyInstanceUid: 'study-1', date: '2024-01-01' }],
      [thumbnailDisplaySet]
    );

    expect(tabs.find(tab => tab.name === 'primary').studies[0].displaySets[0]).toEqual(
      thumbnailDisplaySet
    );
  });
});
