import { useSystem } from '@ohif/core';
import { getSafeCustomization } from './customization';

/**
 * React read of a customization (PLAN.md 6.4). 3.11.1 has no
 * useCustomization hook; at the 3.14 step this delegates to upstream's.
 */
export default function useSafeCustomization<T = unknown>(customizationId: string): T | undefined {
  const { servicesManager } = useSystem();
  return getSafeCustomization<T>(servicesManager?.services?.customizationService, customizationId);
}
