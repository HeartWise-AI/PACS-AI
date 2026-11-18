import RunModelToolbarButton from './RunModelToolbarButton';

/** Toolbar button type (uiType) of the run-model menu. */
export const RUN_MODEL_UI_TYPE = 'pacsAi.runModel';
/** Toolbar button id of the run-model menu. */
export const RUN_MODEL_BUTTON_ID = 'PacsAiRunModel';
/**
 * Toolbar section the PACS-AI viewer header renders after the mode's primary
 * section: `<Toolbar buttonSection="pacsAiViewerHeader" />`.
 */
export const VIEWER_HEADER_SECTION = 'pacsAiViewerHeader';

export default function getToolbarModule() {
  return [
    {
      name: RUN_MODEL_UI_TYPE,
      defaultComponent: RunModelToolbarButton,
    },
  ];
}

/**
 * Adds the PACS-AI buttons to the viewer header section. ToolbarService
 * clears its buttons and sections when a mode is entered (its onModeEnter
 * runs before the extensions'), so this runs from the extension's
 * onModeEnter, for every mode, as the header did when it rendered the button
 * itself. modes/pacs-ai calls it from its own onModeEnter as well.
 */
export function addViewerHeaderButtons(toolbarService): void {
  if (!toolbarService) {
    return;
  }
  toolbarService.register([
    {
      id: RUN_MODEL_BUTTON_ID,
      uiType: RUN_MODEL_UI_TYPE,
      props: {},
    },
  ]);
  toolbarService.updateSection(VIEWER_HEADER_SECTION, [RUN_MODEL_BUTTON_ID]);
}
