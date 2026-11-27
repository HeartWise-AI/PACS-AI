import React from 'react';

const mockCinePlayer = jest.fn((_props: any) => null);
jest.mock('@ohif/ui-next', () => ({ CinePlayer: props => mockCinePlayer(props) }), {
  virtual: true,
});

import PacsAiCinePlayer, { applyPacsAiCinePlayer } from './PacsAiCinePlayer';

describe('PACS-AI cine player', () => {
  test("renders OHIF's player without its vertical placement and with the PACS-AI class", () => {
    const element = PacsAiCinePlayer({
      className: 'absolute left-1/2 bottom-3 -translate-x-1/2',
      frameRate: 15,
    }) as React.ReactElement<any>;
    // ui-next's root has top-10; with OHIF's bottom-3 as well the bar sat at
    // the top of the viewport. The stylesheet places it at the bottom.
    expect(element.props.className).toBe(
      'absolute left-1/2 -translate-x-1/2 pacs-ai-cine-player'
    );
    expect(element.props.frameRate).toBe(15);
  });

  test('drops any top/bottom class and keeps the others', () => {
    const element = PacsAiCinePlayer({ className: 'bottom-30 top-2 -top-1 z-10' }) as React.ReactElement<any>;
    expect(element.props.className).toBe('z-10 pacs-ai-cine-player');
    expect((PacsAiCinePlayer({}) as React.ReactElement<any>).props.className).toBe(
      'pacs-ai-cine-player'
    );
  });

  test('is set as the cinePlayer customization of the mode', () => {
    const customizationService = { Scope: { Mode: 'mode' }, setCustomizations: jest.fn() };
    applyPacsAiCinePlayer(customizationService);
    expect(customizationService.setCustomizations).toHaveBeenCalledWith(
      { cinePlayer: { $set: PacsAiCinePlayer } },
      'mode'
    );
  });
});
