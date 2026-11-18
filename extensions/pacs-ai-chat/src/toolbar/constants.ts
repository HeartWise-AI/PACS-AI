/** Toolbar button type (getToolbarModule `name`, a button's `uiType`). */
export const CHAT_BUTTON_UI_TYPE = 'pacsAi.chatButton';

/** Id of the chat button the extension registers with the toolbar service. */
export const CHAT_BUTTON_ID = 'pacsAiChat';

/**
 * Toolbar section holding the chat button. The PACS-AI viewer header renders
 * it with `<Toolbar buttonSection="pacsAiChat" />` next to the run-model
 * button, where the chat button has always been.
 */
export const CHAT_BUTTON_SECTION = 'pacsAiChat';
