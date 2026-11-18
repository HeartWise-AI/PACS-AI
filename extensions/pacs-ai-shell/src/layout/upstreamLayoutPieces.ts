/**
 * The pieces of @ohif/extension-default's viewer layout that its package
 * index does not export. Our layout template composes them unchanged, so they
 * are imported here, in one place, by source path; check this file first when
 * OHIF is upgraded (docs/ohif-upgrade/PLAN.md 6.4).
 */
// Deep imports by exception (PLAN 6.2; see this package's .eslintrc.json).
// eslint-disable-next-line no-restricted-imports -- not exported by @ohif/extension-default; P3.3
export { default as SidePanelWithServices } from '@ohif/extension-default/src/Components/SidePanelWithServices';
// eslint-disable-next-line no-restricted-imports -- not exported by @ohif/extension-default; P3.3
export { default as useResizablePanels } from '@ohif/extension-default/src/ViewerLayout/ResizablePanelsHook';
