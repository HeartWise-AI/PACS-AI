/**
 * PACS-AI keyboard layout in the viewer (F15): the arrow keys change the
 * series and the page keys change the image, the other way round from OHIF's
 * defaults (platform/core/src/defaults/hotkeyBindings.ts, which PACS-AI used
 * to edit). Applied through the `ohif.hotkeyBindings` customization, which
 * Mode.tsx reads after the mode's onModeEnter.
 */

export const HOTKEY_BINDINGS_CUSTOMIZATION = 'ohif.hotkeyBindings';

type HotkeyBinding = {
  commandName?: string;
  commandOptions?: { direction?: number; [key: string]: unknown };
  keys?: string[];
  [key: string]: unknown;
};

/** The keys PACS-AI uses for a binding, or undefined to keep its keys. */
function pacsAiKeys(binding: HotkeyBinding): string[] | undefined {
  switch (binding.commandName) {
    case 'updateViewportDisplaySet':
      if (binding.commandOptions?.direction === -1) {
        return ['up'];
      }
      if (binding.commandOptions?.direction === 1) {
        return ['down'];
      }
      return undefined;
    case 'previousImage':
      return ['pageup'];
    case 'nextImage':
      return ['pagedown'];
    default:
      return undefined;
  }
}

/**
 * OHIF's bindings with the PACS-AI keys for previous/next series and
 * previous/next image. Other bindings are returned unchanged. Applying it
 * twice gives the same result.
 */
export function withPacsAiHotkeys<T extends HotkeyBinding>(bindings: T[] = []): T[] {
  return bindings.map(binding => {
    const keys = pacsAiKeys(binding);
    return keys ? { ...binding, keys } : binding;
  });
}

/**
 * Sets the PACS-AI keys for the current mode. Run from onModeEnter (mode
 * scope: OHIF clears it when the mode exits).
 */
export function applyPacsAiHotkeys(customizationService): void {
  if (!customizationService) {
    return;
  }
  const current = customizationService.getCustomization(HOTKEY_BINDINGS_CUSTOMIZATION);
  if (!Array.isArray(current)) {
    return;
  }
  customizationService.setCustomizations(
    { [HOTKEY_BINDINGS_CUSTOMIZATION]: { $set: withPacsAiHotkeys(current) } },
    customizationService.Scope?.Mode
  );
}
