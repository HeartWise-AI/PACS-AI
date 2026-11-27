import { spawn } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import React from 'react';
import { TextDecoder } from 'util';
import { act, render as rtlRender, type RenderResult } from '@testing-library/react';
import HTMLOutputModeModal from './HTMLOutputModeModal';
import { ViewerModelResultDrawer } from './viewerResults/ViewerModelResultDrawer';
import {
  createViewerResultsRepository,
  type ViewerResultsHTTPClient,
} from './viewerResults/viewerResultsRepository';
import type { ViewerModelResult } from './viewerResults/types';

// jsdom does not provide TextDecoder, which the report decoder uses.
Object.assign(globalThis, { TextDecoder: globalThis.TextDecoder ?? TextDecoder });

jest.mock('@pacs-ai/ui', () => ({
  StoreFileButton: () => null,
}));

jest.mock('@pacs-ai/extension-core/src/api/orthancRepository', () => ({
  __esModule: true,
  default: {
    GetLnkedDICOMModalityWithEnabledCStore: jest.fn().mockResolvedValue({ data: null }),
  },
}));

jest.mock('./AddModelFeedback', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./studyProcessing/useModelExecutionResultViewer', () => ({
  useModelExecutionResultViewer: () => ({
    state: { key: null, selection: null, status: 'idle', result: null, failure: null },
    open: jest.fn(),
    close: jest.fn(),
    retry: jest.fn(),
  }),
}));

jest.mock('./studyProcessing/modelResults/ModelResultRenderer', () => ({
  ModelResultRenderer: () => null,
}));

jest.mock('./viewerResults/ViewerModelResultFeedback', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: Record<string, unknown> = {}) =>
      String(options.defaultValue ?? _key),
  }),
}));

// Obvious placeholder. The report tries to read whatever the viewer stored under this key.
jest.setTimeout(60000);

const SESSION_TOKEN_KEY = 'sessionToken';
const SESSION_TOKEN_VALUE = 'PLACEHOLDER_SESSION_TOKEN';

// Script a model report can carry. It reports the token when the iframe is same-origin,
// and a security error when the sandbox gives it an opaque origin.
const REPORT_HTML = `<!DOCTYPE html><html><body><script>
var outcome;
try { outcome = 'READ:' + localStorage.getItem('${SESSION_TOKEN_KEY}'); }
catch (error) { outcome = 'BLOCKED:' + (error && error.name); }
parent.postMessage(outcome, '*');
</script></body></html>`;

function reportBase64(): string {
  return Buffer.from(REPORT_HTML, 'utf8').toString('base64');
}

function viewerResult(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'Example model',
    modelVersion: '1.0.0',
    modality: 'XA',
    modelId: 'model-1',
    artifactModelId: null,
    containerId: null,
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: null,
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'VIEWER_REQUEST',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

function repositoryReturning(htmlBase64: string): ViewerResultsHTTPClient {
  return {
    get: jest.fn().mockResolvedValue({
      data: { success: true, message: '', data: { htmlBase64, contentType: 'text/html' } },
    }),
    post: jest.fn(),
  };
}

// The browser probe needs a real Chrome. CHROME_PATH wins; otherwise the usual
// install locations are tried. Without one, only the sandbox attribute is checked.
function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean) as string[];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

const CHROME = findChrome();

function dumpDom(pagePath: string, profile: string): Promise<{ stdout: string; stderr: string }> {
  const chrome = CHROME as string;
  return new Promise(resolve => {
    const child = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--disable-dev-shm-usage',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=2000',
        '--dump-dom',
        `file://${pagePath}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.includes('</html>')) {
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

// Loads the iframe the component actually rendered in Chrome and returns what the
// report script was able to post back: READ:<value>, BLOCKED:<error>, or NO_MESSAGE.
async function probeReportFrame(iframe: Element): Promise<string> {
  const sandbox = iframe.getAttribute('sandbox');
  const srcdoc = iframe.getAttribute('srcdoc') ?? '';
  const spec = Buffer.from(JSON.stringify({ sandbox: sandbox ?? null, srcdoc }), 'utf8').toString(
    'base64'
  );
  const directory = mkdtempSync(path.join(tmpdir(), 'html-report-sandbox-'));
  const pagePath = path.join(directory, 'parent.html');
  const profile = path.join(directory, 'profile');
  writeFileSync(
    pagePath,
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<pre id="out">PENDING</pre>
<script type="application/json" id="spec">${spec}</script>
<script>
  localStorage.setItem(${JSON.stringify(SESSION_TOKEN_KEY)}, ${JSON.stringify(SESSION_TOKEN_VALUE)});
  var spec = JSON.parse(atob(document.getElementById('spec').textContent.trim()));
  var frame = document.createElement('iframe');
  if (spec.sandbox !== null) frame.setAttribute('sandbox', spec.sandbox);
  frame.srcdoc = spec.srcdoc;
  document.body.appendChild(frame);
  window.addEventListener('message', function (event) {
    if (typeof event.data === 'string' && (event.data.indexOf('READ:') === 0 || event.data.indexOf('BLOCKED:') === 0)) {
      document.getElementById('out').textContent = event.data;
    }
  });
  setTimeout(function () {
    var out = document.getElementById('out');
    if (out.textContent === 'PENDING') out.textContent = 'NO_MESSAGE';
  }, 200);
</script>
</body></html>`
  );

  try {
    const result = await dumpDom(pagePath, profile);
    const match = result.stdout.match(/<pre id="out">([^<]*)<\/pre>/);
    if (!match) {
      throw new Error(`Chrome did not render the report probe. ${result.stderr.slice(-500)}`);
    }
    return match[1];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function expectReportCannotReadSession(iframe: Element) {
  // allow-scripts together with allow-same-origin gives the report the viewer's
  // origin; an unsandboxed frame is worse. Neither may ever be rendered.
  const sandbox = iframe.getAttribute('sandbox');
  expect(sandbox).not.toBeNull();
  const tokens = (sandbox ?? '').split(/\s+/).filter(Boolean);
  expect(tokens).not.toContain('allow-same-origin');
  if (!CHROME) {
    console.warn('htmlReportSandbox: no Chrome found (set CHROME_PATH); browser probe skipped');
    return;
  }
  const outcome = await probeReportFrame(iframe);
  expect(outcome).not.toBe('PENDING');
  expect(outcome.startsWith('READ:')).toBe(false);
}

describe('HTML report iframe sandbox', () => {
  let renderer: RenderResult | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  test('a predict HTML report cannot read the viewer session token', async () => {
    await act(async () => {
      renderer = rtlRender(
        <HTMLOutputModeModal
          isOpen
          onClose={() => {}}
          data={{ htmlBase64: reportBase64() }}
          modelName="Example model"
          modelVersion="1.0.0"
          seriesInstanceUIDs="[]"
          outputMode="HTML"
          loading={false}
          title="Example model"
        />
      );
    });

    const iframe = document.body.querySelector('iframe');
    expect(iframe).not.toBeNull();
    await expectReportCannotReadSession(iframe!);
  });

  test('a stored run report cannot read the viewer session token', async () => {
    const result = viewerResult();
    const client = repositoryReturning(reportBase64());
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultDrawer
          result={result}
          repository={createViewerResultsRepository(client)}
          onClose={() => {}}
          onMinimize={() => {}}
          onSelectView={() => true}
        />
      );
    });

    expect(client.get).toHaveBeenCalledWith(
      '/v1/inference/processing/runs/run-1/executions/execution-1/report'
    );
    const iframe = document.body.querySelector('[data-testid="viewer-model-result-report"]');
    expect(iframe).not.toBeNull();
    await expectReportCannotReadSession(iframe!);
  });

  test('a legacy study-service report cannot read the viewer session token', async () => {
    const result = viewerResult({
      runId: null,
      executionId: null,
      studyServiceJobId: 'job-1',
      trigger: null,
    });
    const client = repositoryReturning(reportBase64());
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultDrawer
          result={result}
          repository={createViewerResultsRepository(client)}
          onClose={() => {}}
          onMinimize={() => {}}
          onSelectView={() => true}
        />
      );
    });

    expect(client.get).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/jobs/job-1/report'
    );
    const iframe = document.body.querySelector('[data-testid="viewer-model-result-report"]');
    expect(iframe).not.toBeNull();
    await expectReportCannotReadSession(iframe!);
  });
});
