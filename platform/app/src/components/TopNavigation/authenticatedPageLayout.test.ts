import { readFileSync } from 'fs';
import { resolve } from 'path';

const authenticatedPages = [
  ['worklist', '../../routes/WorkList/WorkList.tsx', 'WorklistTopNavigation'],
  ['AI Models', '../../routes/AIModels/AIModels.tsx', 'TopNavigation'],
  ['settings', '../../routes/Settings/Settings.tsx', 'TopNavigation'],
  ['members', '../../routes/Members/Members.tsx', 'TopNavigation'],
  ['Kibana logs', '../../routes/KibanaLogs/KibanaLogs.tsx', 'TopNavigation'],
  ['workspace settings', '../../routes/WorkspaceSettings/WorkspaceSettings.tsx', 'TopNavigation'],
] as const;

describe('authenticated page top-navigation layout', () => {
  test.each(authenticatedPages)('%s uses the stable shared top-bar layout', (_name, file, nav) => {
    const source = readFileSync(resolve(__dirname, file), 'utf8');

    expect(source).toContain(`<${nav}`);
    expect(source).toContain('flex h-screen w-screen flex-col');
    expect(source).toMatch(/<main className="[^"]*min-h-0[^"]*grow[^"]*overflow-y-auto/);
    expect(source).not.toMatch(/components\/(Sidebar|SidebarAdmin|HeaderPanel)/);
  });
});
