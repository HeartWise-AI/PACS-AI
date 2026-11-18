import { CHAT_BUTTON_ID, CHAT_BUTTON_SECTION, CHAT_BUTTON_UI_TYPE } from './constants';

interface ToolbarServiceLike {
  register: (buttons: Array<{ id: string; uiType: string; props: Record<string, unknown> }>) => void;
  updateSection: (key: string, buttonIds: string[]) => void;
}

/**
 * Adds the chat button to its toolbar section. Called on every mode entry:
 * the toolbar service resets its buttons and sections when a mode is entered,
 * before the extensions' onModeEnter runs.
 */
export function registerChatButton(toolbarService?: ToolbarServiceLike | null): void {
  if (!toolbarService) {
    return;
  }
  toolbarService.register([{ id: CHAT_BUTTON_ID, uiType: CHAT_BUTTON_UI_TYPE, props: {} }]);
  toolbarService.updateSection(CHAT_BUTTON_SECTION, [CHAT_BUTTON_ID]);
}
