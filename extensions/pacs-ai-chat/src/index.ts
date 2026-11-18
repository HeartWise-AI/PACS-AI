import { id } from './id';
import getToolbarModule from './toolbar/getToolbarModule';
import { registerChatButton } from './toolbar/registerChatButton';

export { default as ChatBox } from './ChatBox';
export { default as ChatButton } from './ChatButton';
export type {
  ChatBoxProps,
  ChatCitation,
  ChatModelResultCitation,
  ChatWebSourceCitation,
  Message,
  SeriesInfo,
} from './ChatBox';

export { ChatCitationHostContext } from './citations';
export type { ChatCitationHost, ChatCitationResultActions } from './citations';

export { CHAT_BUTTON_ID, CHAT_BUTTON_SECTION, CHAT_BUTTON_UI_TYPE } from './toolbar/constants';
export { registerChatButton } from './toolbar/registerChatButton';

/**
 * PACS-AI chat extension (docs/ohif-upgrade/PLAN.md 6.1, F8 and F20): the
 * chat button as a toolbar button type, added on every mode entry to the
 * `pacsAiChat` toolbar section that the PACS-AI viewer header renders
 * (modes/pacs-ai also places it from its own onModeEnter).
 * Registered in platform/app/pluginConfig.json.
 */
const pacsAiChatExtension = {
  id,

  getToolbarModule,

  onModeEnter({ servicesManager }) {
    registerChatButton(servicesManager?.services?.toolbarService);
  },
};

export default pacsAiChatExtension;
