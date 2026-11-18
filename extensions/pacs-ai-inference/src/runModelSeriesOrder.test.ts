/**
 * The series order the run-model series dialog offers ("Select first N",
 * "Select maximum") and sends in the run request (`seriesInstanceUIDs`).
 *
 * Source: SelectSeriesModal lists `selectedModalities` (core study context);
 * PacsAiStudyBrowser fills it with buildInferenceStudyModalities from the
 * study browser's tabs; the tabs come from @ohif/core's
 * createStudyBrowserTabs, which on OHIF 3.13 sorts each study's display sets
 * with the `sortingCriteria` customization (default extension:
 * seriesInfoSortingCriteria = series number, then series date and time, then
 * SeriesInstanceUID; SR/SEG last).
 *
 * On OHIF 3.11.1 createStudyBrowserTabs did not sort: the dialog took the
 * display sets in the order their series metadata responses arrived. The
 * requests went out in series-number order, so the order was series number
 * with neighbours swapped at random: the reference runs recorded on the 3.11
 * viewer give a different order for the same study on every run (and twice
 * a different "first N" set). That order cannot be reproduced; 3.13's is the
 * same series-number order without the jitter, the same on every load.
 */
import { describe, test, expect, jest } from '@jest/globals';

let mockServices: any;
jest.mock('@ohif/core/src/contextProviders/SystemProvider', () => ({
  useSystem: () => ({ servicesManager: { services: mockServices } }),
}));
jest.mock('i18next', () => ({ __esModule: true, default: { t: (key: string) => key } }));

import { createStudyBrowserTabs } from '@ohif/core/src/utils/createStudyBrowserTabs';
import { seriesSortCriteria } from '@ohif/core/src/utils/sortStudy';
import { buildInferenceStudyModalities } from './buildInferenceStudyModalities';

const STUDY = 'study-1';

// Display sets of one XA study; two series share number 2 and two number 3
// (as in the reference studies), told apart by series time.
const displaySets = [
  { n: 1, time: '114639', uid: 's1' },
  { n: 2, time: '114657', uid: 's2a' },
  { n: 2, time: '115853', uid: 's2b' },
  { n: 3, time: '114723', uid: 's3a' },
  { n: 3, time: '115921', uid: 's3b' },
  { n: 4, time: '114757', uid: 's4' },
  { n: 10, time: '115956', uid: 's10' },
].map(({ n, time, uid }) => ({
  displaySetInstanceUID: `ds-${uid}`,
  SeriesInstanceUID: uid,
  StudyInstanceUID: STUDY,
  SeriesNumber: n,
  SeriesDate: '20261114',
  SeriesTime: time,
  Modality: 'XA',
}));
const report = {
  displaySetInstanceUID: 'ds-sr',
  SeriesInstanceUID: 'sr',
  StudyInstanceUID: STUDY,
  SeriesNumber: 0,
  Modality: 'SR',
};
const all = [...displaySets, report];
const byUID = new Map(all.map(ds => [ds.displaySetInstanceUID, ds]));

/** The series the dialog lists, for display sets that arrived in `arrival` order. */
function dialogOrder(arrival) {
  mockServices = {
    displaySetService: { getDisplaySetByUID: uid => byUID.get(uid) },
    customizationService: {
      getCustomization: key =>
        key === 'sortingCriteria' ? seriesSortCriteria.seriesInfoSortingCriteria : undefined,
    },
  };
  // The study browser's thumbnails (one entry per display set, arrival order).
  const thumbnails = arrival.map(ds => ({
    displaySetInstanceUID: ds.displaySetInstanceUID,
    SeriesInstanceUID: ds.SeriesInstanceUID,
    StudyInstanceUID: ds.StudyInstanceUID,
    seriesNumber: ds.SeriesNumber,
  }));
  const tabs = createStudyBrowserTabs(
    [STUDY],
    [{ studyInstanceUid: STUDY, date: '20261114', modalities: 'XA\\SR' }],
    thumbnails
  );
  const primary = tabs.find(tab => tab.name === 'primary').studies;
  const groups = buildInferenceStudyModalities(primary);
  return Object.values(groups).flatMap(group => group.displaySets.map(ds => ds.SeriesInstanceUID));
}

describe('run-model series order', () => {
  const expected = ['s1', 's2a', 's2b', 's3a', 's3b', 's4', 's10', 'sr'];

  test('is series number, then series time, then UID, with SR last', () => {
    expect(dialogOrder(all)).toEqual(expected);
  });

  test('does not depend on the order the series metadata arrived in', () => {
    const arrivals = [
      [...all].reverse(),
      [all[2], all[0], all[1], all[4], all[3], all[7], all[6], all[5]],
      [all[7], all[6], all[1], all[3], all[0], all[5], all[2], all[4]],
    ];
    arrivals.forEach(arrival => expect(dialogOrder(arrival)).toEqual(expected));
  });

  test('"Select first N" therefore picks the same series every time', () => {
    const firstFour = dialogOrder([...all].reverse()).slice(0, 4);
    expect(firstFour).toEqual(['s1', 's2a', 's2b', 's3a']);
  });
});
