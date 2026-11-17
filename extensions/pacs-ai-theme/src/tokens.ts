/**
 * PACS-AI brand colours. On OHIF 3.11.1 the same values are still hard-coded
 * in the upstream Tailwind configs and CSS ("theme debt", see
 * docs/ohif-upgrade/PLAN.md 6.3); they move here when the 3.13 theme
 * customization exists.
 */
export const colors = {
  /** Lime accent. */
  primary: '#C8F469',
  /** Gradient end colour used by primary buttons. */
  primaryGradientEnd: '#05905E',
  /** Page background. */
  background: '#151815',
} as const;

/** Background of primary buttons (lime to green). */
export const primaryGradient = `linear-gradient(98.05deg, ${colors.primary} 21.15%, ${colors.primaryGradientEnd} 100%)`;
