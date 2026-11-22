import { useViewportRef } from '@ohif/core';

/**
 * OHIF compatibility adapter (PLAN.md 6.4): the DOM element ref of a viewport.
 * 3.11.1: useViewportRef; at the 3.14 step this becomes useViewportElement.
 */
export default function useViewportElement(viewportId: string) {
  return useViewportRef(viewportId);
}
