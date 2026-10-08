import { useSystem } from '../contextProviders/SystemProvider';
import { createStudyBrowserTabs } from './createStudyBrowserTabs';

jest.mock('../contextProviders/SystemProvider', () => ({
  useSystem: jest.fn(),
}));

const mockedUseSystem = useSystem as jest.Mock;

describe('createStudyBrowserTabs PACS-AI contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds the active SeriesInstanceUID to matching thumbnail display sets', () => {
    const displaySetService = {
      activeDisplaySets: [
        {
          displaySetInstanceUID: 'display-set-1',
          SeriesInstanceUID: 'series-1',
        },
      ],
    };
    mockedUseSystem.mockReturnValue({
      servicesManager: { services: { displaySetService } },
    });

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
    const displaySetService = {
      activeDisplaySets: [
        {
          displaySetInstanceUID: 'another-display-set',
          SeriesInstanceUID: 'another-series',
        },
      ],
    };
    mockedUseSystem.mockReturnValue({
      servicesManager: { services: { displaySetService } },
    });

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
