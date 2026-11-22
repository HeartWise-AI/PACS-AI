import React from 'react';

const mockCinePlayer = jest.fn((_props: any) => null);
jest.mock('@ohif/ui-next', () => ({ CinePlayer: props => mockCinePlayer(props) }), {
  virtual: true,
});

import PacsAiCinePlayer, { applyPacsAiCinePlayer } from './PacsAiCinePlayer';

describe('PACS-AI cine player', () => {
  test("renders OHIF's player lower and with the PACS-AI class", () => {
    const element = PacsAiCinePlayer({
      className: 'absolute left-1/2 bottom-3 -translate-x-1/2',
      frameRate: 15,
    }) as React.ReactElement<any>;
    expect(element.props.className).toBe(
      'absolute left-1/2 bottom-8 -translate-x-1/2 pacs-ai-cine-player'
    );
    expect(element.props.frameRate).toBe(15);
  });

  test('keeps other class names as they are', () => {
    const element = PacsAiCinePlayer({ className: 'bottom-30 top-2' }) as React.ReactElement<any>;
    expect(element.props.className).toBe('bottom-30 top-2 pacs-ai-cine-player');
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
