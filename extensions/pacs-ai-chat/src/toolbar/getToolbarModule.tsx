import React from 'react';

import ChatButton from '../ChatButton/ChatButton';
import { CHAT_BUTTON_UI_TYPE } from './constants';

/**
 * The chat button as a toolbar button type. The toolbar passes its own props
 * (id, isOpen, onInteraction, ...); the chat button keeps its own open state
 * and only needs the services, so they are not forwarded.
 */
export default function getToolbarModule({ servicesManager }: { servicesManager: unknown }) {
  function PacsAiChatToolbarButton() {
    return <ChatButton servicesManager={servicesManager} />;
  }

  return [
    {
      name: CHAT_BUTTON_UI_TYPE,
      defaultComponent: PacsAiChatToolbarButton,
    },
  ];
}
