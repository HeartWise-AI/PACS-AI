import { createContext, useContext, useEffect, useRef } from 'react';
import type { ChatModelResultCitation } from '../types';

// What the application that hosts the chat can do with a cited model result.
// The chat does not know the viewer: the viewer provides this through
// ChatCitationHostContext around wherever the chat is mounted.
export interface ChatCitationResultActions {
  // Opens that exact stored result; null when the host does not hold it.
  open: (() => void) | null;
  // Loads the stored raw result data; absent when the host has no access to it.
  loadRawResult?: (() => Promise<unknown>) | null;
  // True while the host is still loading the results it could open.
  loading?: boolean;
}

export interface ChatCitationHost {
  resolveModelResult: (citation: ChatModelResultCitation) => ChatCitationResultActions;
  // A model result citation is being shown: the host can bring the results it
  // holds up to date.
  onModelResultShown?: (citation: ChatModelResultCitation) => void;
}

export const ChatCitationHostContext = createContext<ChatCitationHost | null>(null);

const UNAVAILABLE: ChatCitationResultActions = { open: null, loadRawResult: null };

/**
 * The host's actions for the cited model result being shown; none outside a
 * host.
 */
export function useChatCitationResultActions(
  citation: ChatModelResultCitation
): ChatCitationResultActions {
  const host = useContext(ChatCitationHostContext);
  const shown = useRef({ host, citation });
  shown.current = { host, citation };
  useEffect(() => {
    shown.current.host?.onModelResultShown?.(shown.current.citation);
  }, []);
  return host?.resolveModelResult(citation) || UNAVAILABLE;
}
