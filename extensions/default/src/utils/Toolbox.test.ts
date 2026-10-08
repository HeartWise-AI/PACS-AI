import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useActiveToolOptions, useSystem, useToolbar } from '@ohif/core';
import { Toolbox } from './Toolbox';

jest.mock('@ohif/core', () => ({
  useActiveToolOptions: jest.fn(),
  useSystem: jest.fn(),
  useToolbar: jest.fn(),
}));

jest.mock('@ohif/ui-next', () => {
  const React = require('react');
  const PanelSection = ({ children }) => React.createElement('section', null, children);
  PanelSection.Header = ({ children, className }) =>
    React.createElement('header', { className }, children);
  PanelSection.Content = ({ children, className }) =>
    React.createElement('div', { 'data-panel-content': 'true', className }, children);

  return {
    Icons: { Settings: () => React.createElement('span') },
    PanelSection,
    ToolSettings: ({ options }) =>
      React.createElement('div', {
        'data-tool-settings': 'true',
        'data-options': JSON.stringify(options),
      }),
  };
});

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: value => value }) }));

describe('Toolbox OHIF 3.12 and PACS integration contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const Tool = ({ id }) => React.createElement('button', { 'data-tool-id': id });
    const toolbarService = {
      getButtonSection: jest.fn(() => [
        { id: 'visible-tool', Component: Tool, componentProps: { visible: true } },
        { id: 'hidden-tool', Component: Tool, componentProps: { visible: false } },
      ]),
    };

    (useSystem as jest.Mock).mockReturnValue({
      servicesManager: {
        services: {
          toolbarService,
          customizationService: { getCustomization: jest.fn(() => null) },
        },
      },
    });
    (useToolbar as jest.Mock).mockReturnValue({
      toolbarButtons: [{ componentProps: { buttonSection: 'tools' } }],
      onInteraction: jest.fn(),
    });
    (useActiveToolOptions as jest.Mock).mockReturnValue({
      activeToolOptions: { interactionType: 'tool-options' },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it('uses active-tool options, hides invisible tools, and retains PACS panel styling', () => {
    act(() => {
      root.render(React.createElement(Toolbox, { buttonSectionId: 'measurement', title: 'Tools' }));
    });

    expect(container.querySelector('[data-tool-id="visible-tool"]')).not.toBeNull();
    expect(container.querySelector('[data-tool-id="hidden-tool"]')).toBeNull();
    expect(
      container.querySelector('[data-tool-settings="true"]')?.getAttribute('data-options')
    ).toBe(JSON.stringify({ interactionType: 'tool-options' }));
    expect(container.querySelector('[data-panel-content="true"]')?.className).toContain(
      'bg-transparent'
    );
    expect(useActiveToolOptions).toHaveBeenCalledWith({ buttonSectionId: 'measurement' });
  });
});
