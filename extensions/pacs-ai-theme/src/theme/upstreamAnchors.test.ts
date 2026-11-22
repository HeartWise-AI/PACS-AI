import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * pacs-ai-theme.css restyles upstream components it cannot reach otherwise by
 * matching their class strings. Each such rule is preceded by
 *   /* @upstream <file> :: <text the selector relies on> *\/
 * This test fails when an upstream file no longer contains that text, which
 * means an OHIF upgrade changed the component: re-check the rule.
 */
const root = resolve(__dirname, '../../../..');
const css = readFileSync(resolve(__dirname, '../styles/pacs-ai-theme.css'), 'utf8');
const anchors = [...css.matchAll(/@upstream (\S+) :: (.+?) \*\//g)].map(([, file, text]) => ({
  file,
  text: text.trim(),
}));

describe('upstream anchors of pacs-ai-theme.css', () => {
  test('there are anchors', () => {
    expect(anchors.length).toBeGreaterThan(30);
  });

  test.each(anchors.map(a => [a.file, a.text]))('%s contains %s', (file, text) => {
    const path = resolve(root, file);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain(text);
  });
});
