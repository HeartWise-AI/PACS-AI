/**
 * The PACS-AI theme as an OHIF 3.13 theme preset (the shape of
 * `platform/ui-next/src/themes/*.json`, `ThemePreset` in
 * `platform/ui-next/src/themes/index.ts`): HSL triplets without `hsl()`, the
 * form ui-next's Tailwind colours read (`hsl(var(--primary))`).
 *
 * Started from upstream's neutral dark preset `midnight.json` (every token is
 * set, as there) and moved to the PACS-AI palette of the 3.11.1 fork
 * (98359e881). The fork hard-coded these colours in 66 upstream files
 * ("theme debt", PLAN P3.4); each value below names the colour it replaces:
 *
 * - lime `#C8F469`: `primary`, `highlight`, `ring` (fork: `--primary`,
 *   `--highlight`, `primary-*`/`secondary-light|dark`/`inputfield-main` in the
 *   app Tailwind palette, `text-primary` in overlays and toggles);
 * - `#151815`: `background`, `card`, `accent` (menu-item hover, fork
 *   `hover:bg-[#151815]`), `primary-foreground` (dark text on lime, fork
 *   `text-background` in the default Button);
 * - `#4C504B`: `popover`, `muted` (fork `bg-[#4C504B]` in Popover,
 *   DropdownMenu, Dialog, HoverCard, Tooltip, ViewportDialog, layout menu);
 * - translucent whites, flattened because the tokens must stay plain triplets
 *   (ui-next uses opacity modifiers such as `border-input/50`):
 *   `border` = white/10 over `#151815`, `input` = white/10 over `#4C504B`
 *   (the fork's `border-white/10` on popovers), `muted-foreground` =
 *   white/80 over `#151815` (fork `text-foreground/80`).
 *
 * `secondary`/`secondary-foreground` keep the fork's values (not edited by any
 * fork component change); `neutral*`, `destructive*` and the chart colours are
 * upstream's defaults (`platform/ui-next/src/tailwind.css`).
 *
 * pacs-ai-theme.css carries the same values as CSS; a unit test keeps the two
 * equal (upstream keeps its presets' JSON and themes.css equal by hand).
 */
export interface PacsAiThemePreset {
  name: string;
  label: string;
  cssVars: {
    dark: Record<string, string>;
  };
}

export const PACS_AI_THEME_NAME = 'pacs-ai';

/** Class set on `document.body`, as upstream's `theme-<name>` presets. */
export const PACS_AI_THEME_CLASS = `theme-${PACS_AI_THEME_NAME}`;

export const pacsAiTheme: PacsAiThemePreset = {
  name: PACS_AI_THEME_NAME,
  label: 'PACS-AI',
  cssVars: {
    dark: {
      highlight: '79 86.3% 68.4%',
      neutral: '213 22% 59%',
      'neutral-light': '214 69% 81%',
      'neutral-dark': '214 16% 21%',
      background: '120 6.7% 8.8%',
      foreground: '0 0% 100%',
      card: '120 6.7% 8.8%',
      'card-foreground': '0 0% 100%',
      popover: '108 3.2% 30.4%',
      'popover-foreground': '0 0% 100%',
      primary: '79 86.3% 68.4%',
      'primary-foreground': '120 6.7% 8.8%',
      secondary: '255 66% 25%',
      'secondary-foreground': '79 86% 68%',
      muted: '108 3.2% 30.4%',
      'muted-foreground': '0 0% 82%',
      accent: '120 6.7% 8.8%',
      'accent-foreground': '0 0% 100%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      border: '120 3% 17.9%',
      input: '108 2.4% 37.4%',
      ring: '79 86.3% 68.4%',
      'chart-1': '220 70% 50%',
      'chart-2': '160 60% 45%',
      'chart-3': '30 80% 55%',
      'chart-4': '280 65% 60%',
      'chart-5': '340 75% 55%',
    },
  },
};
