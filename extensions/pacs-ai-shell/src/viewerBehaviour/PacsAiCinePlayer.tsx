import React from 'react';
import { CinePlayer } from '@ohif/ui-next';
import './pacsAiCinePlayer.css';

export const CINE_PLAYER_CUSTOMIZATION = 'cinePlayer';

/** Class the stylesheet next to this file keys on. */
export const PACS_AI_CINE_PLAYER_CLASS = 'pacs-ai-cine-player';

/** Tailwind top/bottom classes OHIF passes; the stylesheet places the player. */
const VERTICAL_PLACEMENT = /^-?(top|bottom)-/;

/**
 * The cine player OHIF renders in each viewport (the `cinePlayer`
 * customization), as PACS-AI styles it: our grey bar, white "FPS", and the
 * player at the bottom centre of the viewport, between the bottom-left
 * (W/L) and bottom-right (frame) overlays, faded until hovered or focused.
 *
 * @ohif/ui-next's CinePlayer root always carries `top-10`; OHIF's cornerstone
 * extension adds `bottom-3`. With both set the root stretched over the whole
 * viewport height and the bar showed at the top, over the image. The
 * wrapper drops OHIF's vertical placement classes and the stylesheet next to
 * this file sets top/bottom instead. Same props as @ohif/ui-next's
 * CinePlayer.
 */
function PacsAiCinePlayer({ className = '', ...props }: { className?: string; [key: string]: any }) {
  const placed = className
    .split(/\s+/)
    .filter(name => name && !VERTICAL_PLACEMENT.test(name))
    .join(' ');
  // The props OHIF's cornerstone CinePlayer passes to the `cinePlayer`
  // customization, unchanged.
  const cinePlayerProps = {
    ...props,
    className: `${placed} ${PACS_AI_CINE_PLAYER_CLASS}`.trim(),
  } as React.ComponentProps<typeof CinePlayer>;
  return <CinePlayer {...cinePlayerProps} />;
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
