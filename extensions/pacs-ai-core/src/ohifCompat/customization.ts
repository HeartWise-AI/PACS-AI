/**
 * OHIF compatibility adapter (docs/ohif-upgrade/PLAN.md 6.4): customization
 * reads. 3.11.1: customizationService.getCustomization; the 3.14 step moves
 * React reads to upstream's useCustomization. Plain module (no @ohif/core
 * import) so callers stay testable without an OHIF app.
 */
type CustomizationServiceLike = {
  getCustomization?: (customizationId: string) => unknown;
};

/**
 * The customization registered under `customizationId`, or undefined when
 * there is none or the service is unavailable. Never throws.
 */
export function getSafeCustomization<T = unknown>(
  customizationService: CustomizationServiceLike | null | undefined,
  customizationId: string
): T | undefined {
  try {
    return customizationService?.getCustomization?.(customizationId) as T | undefined;
  } catch (error) {
    console.warn(`PACS-AI: customization ${customizationId} could not be read`, error);
    return undefined;
  }
}
