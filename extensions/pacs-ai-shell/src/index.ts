import { id } from './id';

/**
 * PACS-AI shell extension (docs/ohif-upgrade/PLAN.md 6.1): our pages as
 * routes.customRoutes, the work list, top navigation, the viewer layout
 * template and the viewer tour gating. Registered in
 * platform/app/pluginConfig.json after @pacs-ai/extension-core.
 */
const pacsAiShellExtension = {
  id,
};

export default pacsAiShellExtension;
