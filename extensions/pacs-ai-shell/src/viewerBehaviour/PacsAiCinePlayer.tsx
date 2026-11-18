import React from 'react';
import { CinePlayer } from '@ohif/ui-next';
import './pacsAiCinePlayer.css';

export const CINE_PLAYER_CUSTOMIZATION = 'cinePlayer';

/** Class the stylesheet next to this file keys on. */
export const PACS_AI_CINE_PLAYER_CLASS = 'pacs-ai-cine-player';

/**
 * The cine player OHIF renders in each viewport (the `cinePlayer`
 * customization), as PACS-AI styled it: our grey bar, white "FPS", and the
 * player placed `bottom-8` instead of OHIF's `bottom-3`. Same props as
 * @ohif/ui-next's CinePlayer; the colours were edits in ui-next's
 * CinePlayer.tsx and the position an edit in the cornerstone extension's
 * CinePlayer.tsx before P2.6.
 */
function PacsAiCinePlayer({ className = '', ...props }: { className?: string; [key: string]: any }) {
  const placed = className.split(/\s+/).includes('bottom-3')
    ? className.replace(/(^|\s)bottom-3(?=\s|$)/, '$1bottom-8')
    : className;
  return (
    <CinePlayer
      {...props}
      className={`${placed} ${PACS_AI_CINE_PLAYER_CLASS}`.trim()}
    />
  );
}

export default PacsAiCinePlayer;

/** Uses the PACS-AI cine player for the current mode (run from onModeEnter). */
export function applyPacsAiCinePlayer(customizationService): void {
  if (!customizationService) {
    return;
  }
  customizationService.setCustomizations(
    { [CINE_PLAYER_CUSTOMIZATION]: { $set: PacsAiCinePlayer } },
    customizationService.Scope?.Mode
  );
}
