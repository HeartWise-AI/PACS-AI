import i18n from 'i18next';
import PacsAiSeriesListPanel from './PacsAiSeriesListPanel';
import PacsAiTrackedSeriesListPanel from './PacsAiTrackedSeriesListPanel';

/**
 * The PACS-AI study browser panels, with the same icon and label as OHIF's:
 * `seriesList` replaces `@ohif/extension-default.panelModule.seriesList`,
 * `trackedSeriesList` replaces
 * `@ohif/extension-measurement-tracking.panelModule.seriesList` (needs that
 * extension's tracking context).
 */
export default function getPanelModule() {
  return [
    {
      name: 'seriesList',
      iconName: 'tab-studies',
      iconLabel: 'Studies',
      label: i18n.t('SidePanel:Studies'),
      component: PacsAiSeriesListPanel,
    },
    {
      name: 'trackedSeriesList',
      iconName: 'tab-studies',
      iconLabel: 'Studies',
      label: i18n.t('SidePanel:Studies'),
      component: PacsAiTrackedSeriesListPanel,
    },
  ];
}
