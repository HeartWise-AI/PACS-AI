/**
 * The pieces of @ohif/extension-default's viewer layout that its package
 * index does not export. Our layout template composes them unchanged, so they
 * are imported here, in one place, by source path; check this file first when
 * OHIF is upgraded (docs/ohif-upgrade/PLAN.md 6.4).
 */
export { default as SidePanelWithServices } from '@ohif/extension-default/src/Components/SidePanelWithServices';
export { default as useResizablePanels } from '@ohif/extension-default/src/ViewerLayout/ResizablePanelsHook';
