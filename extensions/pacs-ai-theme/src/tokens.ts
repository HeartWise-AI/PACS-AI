/**
 * PACS-AI brand colours for code that needs a literal value (gradients, inline
 * styles). The ui-next tokens (CSS variables) are in theme/pacsAiTheme.ts and
 * styles/pacs-ai-theme.css.
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
