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

  it('does nothing without a toolbar service', () => {
    expect(() => addViewerHeaderButtons(undefined)).not.toThrow();
  });
});
