import CurrentSeriesLabel, { CURRENT_SERIES_UI_TYPE } from '../viewerBehaviour/CurrentSeriesLabel';

/** Toolbar button types of the shell: the current-series label of the viewport action bar. */
export default function getToolbarModule() {
  return [
    {
      name: CURRENT_SERIES_UI_TYPE,
      defaultComponent: CurrentSeriesLabel,
    },
  ];
}
