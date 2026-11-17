/**
 * `@pacs-ai/extension-chat/citations`: what the viewer can do with a model
 * result the chat cites (F20). The viewer provides ChatCitationHostContext
 * (ViewerModelResultsProvider wraps the viewer in it) and the chat, rendered
 * in a portal, reads it.
 *
 * A separate entry point so that the provider gets the context without
 * loading the chat itself (package.json "exports").
 */
export { ChatCitationHostContext } from './ChatBox/citations/ChatCitationHost';
export type {
  ChatCitationHost,
  ChatCitationResultActions,
} from './ChatBox/citations/ChatCitationHost';
export type { ChatModelResultCitation } from './ChatBox/types';
