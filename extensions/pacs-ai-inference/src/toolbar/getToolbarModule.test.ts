import ToolbarService from '@ohif/core/src/services/ToolBarService/ToolbarService';
import { registerModeToolbar } from '@ohif/mode-basic/src/modeCustomization';
import getToolbarModule, {
  addViewerHeaderButtons,
  RUN_MODEL_BUTTON_ID,
  RUN_MODEL_UI_TYPE,
  VIEWER_HEADER_SECTION,
} from './getToolbarModule';

jest.mock('./RunModelToolbarButton', () => ({
  __esModule: true,
  default: 'RunModelToolbarButton',
}));

describe('inference toolbar module', () => {
  it('provides the run-model button type', () => {
    expect(getToolbarModule()).toEqual([
      { name: RUN_MODEL_UI_TYPE, defaultComponent: 'RunModelToolbarButton' },
    ]);
  });

  it('puts the run-model button in the viewer header section', () => {
    const toolbarService = { register: jest.fn(), updateSection: jest.fn() };

    addViewerHeaderButtons(toolbarService);

    expect(toolbarService.register).toHaveBeenCalledWith([
      { id: RUN_MODEL_BUTTON_ID, uiType: RUN_MODEL_UI_TYPE, props: {} },
    ]);
    expect(toolbarService.updateSection).toHaveBeenCalledWith(VIEWER_HEADER_SECTION, [
      RUN_MODEL_BUTTON_ID,
    ]);
  });

  // OHIF 3.13: the mode's onModeEnter registers the mode toolbar
  // (registerModeToolbar) after the extensions' onModeEnter added our button.
  it('keeps the run-model button when the mode registers its toolbar afterwards', () => {
    const extensionManager = {
      modules: {
        toolbarModule: [
          { extensionId: '@pacs-ai/extension-inference', module: getToolbarModule() },
        ],
      },
    };
    const toolbarService = new ToolbarService(
      { run: jest.fn() } as never,
      extensionManager as never,
      { services: {} } as never
    );

    toolbarService.onModeEnter();
    addViewerHeaderButtons(toolbarService);
    registerModeToolbar(
      { toolbarService },
      {
        toolbarButtons: [{ id: 'Zoom', uiType: 'ohif.toolButton', props: {} }],
        toolbarSections: [{ primary: ['Zoom'] }],
      }
    );

    const section = toolbarService.getButtonSection(VIEWER_HEADER_SECTION);
    expect(section.map(button => button.id)).toEqual([RUN_MODEL_BUTTON_ID]);
  });

  it('does nothing without a toolbar service', () => {
    expect(() => addViewerHeaderButtons(undefined)).not.toThrow();
  });
});
