import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pacsAiTheme, PACS_AI_THEME_CLASS } from './pacsAiTheme';

const css = readFileSync(resolve(__dirname, '../styles/pacs-ai-theme.css'), 'utf8');
const upstreamThemes = resolve(__dirname, '../../../../platform/ui-next/src/themes');

function tokenBlock(): Record<string, string> {
  const match = css.match(new RegExp(`\\n\\.${PACS_AI_THEME_CLASS} \\{([^}]*)\\}`));
  if (!match) {
    throw new Error('no token block in pacs-ai-theme.css');
  }
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  );
}

const HSL_TRIPLET = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;

describe('PACS-AI theme preset', () => {
  test('has the shape of an upstream preset and sets every token midnight sets', () => {
    const midnight = JSON.parse(readFileSync(resolve(upstreamThemes, 'midnight.json'), 'utf8'));
    expect(Object.keys(pacsAiTheme)).toEqual(Object.keys(midnight));
    for (const token of Object.keys(midnight.cssVars.dark)) {
      expect(pacsAiTheme.cssVars.dark).toHaveProperty(token);
    }
  });

  test('uses plain HSL triplets (ui-next adds opacity modifiers to them)', () => {
    for (const [token, value] of Object.entries(pacsAiTheme.cssVars.dark)) {
      expect(`${token}: ${value}`).toMatch(new RegExp(`^${token}: `));
      expect(value).toMatch(HSL_TRIPLET);
    }
  });

  test('pacs-ai-theme.css carries exactly the preset values', () => {
    expect(tokenBlock()).toEqual(pacsAiTheme.cssVars.dark);
  });

  test('maps the brand colours of the 3.11.1 fork', () => {
    const dark = pacsAiTheme.cssVars.dark;
    const lime = '79 86.3% 68.4%'; // #C8F469
    const dark151815 = '120 6.7% 8.8%'; // #151815
    const grey4C504B = '108 3.2% 30.4%'; // #4C504B
    expect(dark.primary).toBe(lime);
    expect(dark.highlight).toBe(lime);
    expect(dark.background).toBe(dark151815);
    expect(dark.accent).toBe(dark151815);
    expect(dark['primary-foreground']).toBe(dark151815);
    expect(dark.popover).toBe(grey4C504B);
    expect(dark.muted).toBe(grey4C504B);
  });
});
