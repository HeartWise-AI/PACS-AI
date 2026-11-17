import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolbarService from '@ohif/core/src/services/ToolBarService/ToolbarService';

import pacsAiChatExtension, {
  CHAT_BUTTON_ID,
  CHAT_BUTTON_SECTION,
  CHAT_BUTTON_UI_TYPE,
  ChatCitationHostContext,
} from './index';

// The real series picker pulls in @ohif/ui-next, which this jest setup does
// not transform; the chat button is replaced below anyway.
jest.mock('./seriesSelection/SelectSeriesModal', () => ({ __esModule: true, default: () => null }));

jest.mock('./ChatButton/ChatButton', () => ({
  __esModule: true,
  default: ({ servicesManager }) => (
    <button
      type="button"
      data-cy="chat-button-stub"
    >
      {servicesManager.name}
    </button>
  ),
}));

function createToolbarService(servicesManager) {
  const toolbarModule = pacsAiChatExtension.getToolbarModule({ servicesManager });
  const extensionManager = {
    modules: { toolbarModule: [{ extensionId: pacsAiChatExtension.id, module: toolbarModule }] },
  };
  return new ToolbarService(
    { run: jest.fn() } as never,
    extensionManager as never,
    { services: {} } as never
  );
}

describe('@pacs-ai/extension-chat', () => {
  it('has the package id', () => {
    expect(pacsAiChatExtension.id).toBe('@pacs-ai/extension-chat');
  });

  it('exports the citation host context for the viewer to provide', () => {
    expect(ChatCitationHostContext).toBeDefined();
    expect(ChatCitationHostContext.Provider).toBeDefined();
  });

  it('offers the chat button as a toolbar button type', () => {
    const [buttonType] = pacsAiChatExtension.getToolbarModule({ servicesManager: {} });
    expect(buttonType.name).toBe(CHAT_BUTTON_UI_TYPE);
    expect(typeof buttonType.defaultComponent).toBe('function');
  });

  it('adds the chat button to its section on mode entry, once per entry', () => {
    const servicesManager = { name: 'services' } as Record<string, unknown>;
    const toolbarService = createToolbarService(servicesManager);
    servicesManager.services = { toolbarService };

    toolbarService.onModeEnter();
    pacsAiChatExtension.onModeEnter({ servicesManager });
    pacsAiChatExtension.onModeEnter({ servicesManager });

    const section = toolbarService.getButtonSection(CHAT_BUTTON_SECTION);
    expect(section).toHaveLength(1);
    expect(section[0].id).toBe(CHAT_BUTTON_ID);

    // A new mode entry resets the toolbar; the extension adds the button again.
    toolbarService.onModeEnter();
    expect(toolbarService.getButtonSection(CHAT_BUTTON_SECTION)).toHaveLength(0);
    pacsAiChatExtension.onModeEnter({ servicesManager });
    expect(toolbarService.getButtonSection(CHAT_BUTTON_SECTION)).toHaveLength(1);
  });

  it('renders the chat button with the services, ignoring the toolbar props', () => {
    const servicesManager = { name: 'the services' } as Record<string, unknown>;
    const toolbarService = createToolbarService(servicesManager);
    servicesManager.services = { toolbarService };
    pacsAiChatExtension.onModeEnter({ servicesManager });

    const [{ id, Component, componentProps }] =
      toolbarService.getButtonSection(CHAT_BUTTON_SECTION);
    render(
      <Component
        id={id}
        isOpen={false}
        onInteraction={jest.fn()}
        {...componentProps}
      />
    );

    expect(screen.getByText('the services')).toBeTruthy();
  });

  it('does nothing on mode entry without a toolbar service', () => {
    expect(() => pacsAiChatExtension.onModeEnter({ servicesManager: { services: {} } })).not.toThrow();
  });
});
