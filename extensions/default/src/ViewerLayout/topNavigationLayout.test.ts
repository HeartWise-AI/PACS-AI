import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('viewer top-navigation layout', () => {
  const source = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');

  test('uses the shared top bar without a dynamic application rail', () => {
    expect(source).toContain("import TopNavigation from '@ohif/app/src/components/TopNavigation'");
    expect(source).toContain('<TopNavigation title="Viewer" />');
    expect(source).not.toMatch(/components\/(Sidebar|HeaderPanel)/);
    expect(source).not.toContain('InvestigationalUseDialog');
  });

  test('gives the clinical viewport the stable remaining flex area', () => {
    expect(source).toContain('flex h-screen w-screen flex-col overflow-hidden');
    expect(source).toMatch(/<main className="[^"]*min-h-0[^"]*grow[^"]*overflow-hidden/);
    expect(source).toMatch(
      /className="relative flex min-h-0 w-full grow flex-row flex-nowrap items-stretch/
    );
    expect(source).toContain('<ResizablePanelGroup {...resizablePanelGroupProps}>');
    expect(source).not.toContain('calc(100vh');
  });
});
