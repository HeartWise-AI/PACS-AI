/**
 * Model output is embedded in the viewer origin.
 *
 * These checks fail while that document can read localStorage.sessionToken
 * or the web app frame is posted with targetOrigin '*'. They pass once the
 * framed model document cannot read the parent token and the web app frame
 * is not posted to every origin.
 *
 * Run from the repository root:
 *   npm install --prefix /tmp/pacs-ai-frame-test esbuild@0.25.12 react@18.3.1 react-dom@18.3.1 @playwright/test@1.56.1
 *   NODE_PATH=/tmp/pacs-ai-frame-test/node_modules npx --prefix /tmp/pacs-ai-frame-test playwright install chromium
 *   NODE_PATH=/tmp/pacs-ai-frame-test/node_modules node extensions/pacs-ai-inference/src/security/modelFrameSecurity.test.mjs
 *
 * Needs react, react-dom, esbuild, and @playwright/test on NODE_PATH or in
 * the repository node_modules, and a Playwright Chromium build.
 */
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const PLACEHOLDER_SESSION_TOKEN = 'placeholder-session-token';
const CONTAINER_NAME = 'model-web';
const WEBAPP_PATH = '/app/viewer/';
const WEBAPP_DATA = 'placeholder-model-payload';

const ATTACK_DOCUMENT = `<!DOCTYPE html>
<html>
<body>
<script>
  var value = null;
  var error = null;
  try {
    value = window.parent.localStorage.getItem('sessionToken');
  } catch (e) {
    error = String(e);
  }
  window.parent.postMessage({ type: 'exfil', value: value, error: error }, '*');
</script>
</body>
</html>
`;

const HOP_BY_HOP = new Set([
  'connection',
  'proxy-connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function singleJoiningSlash(a, b) {
  const aslash = a.endsWith('/');
  const bslash = b.startsWith('/');
  if (aslash && bslash) {
    return a + b.slice(1);
  }
  if (!aslash && !bslash) {
    return a + '/' + b;
  }
  return a + b;
}

function upstreamPathFor(requestPath, containerName) {
  const prefix = `/proxy/docker-inference/${containerName}/app/viewer`;
  if (!requestPath.startsWith(prefix)) {
    return null;
  }
  const trimmed = requestPath.slice(prefix.length);
  return singleJoiningSlash('/app/viewer', trimmed);
}

function packageDir(name) {
  const roots = [
    path.join(repoRoot, 'node_modules'),
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  ];
  return roots.map(root => path.join(root, name));
}

function loadPackage(name) {
  const require = createRequire(import.meta.url);
  const errors = [];
  for (const candidate of packageDir(name)) {
    try {
      return require(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(`Cannot load ${name}.\n${errors.join('\n')}`);
}

function listen(server) {
  server.listen(0, '127.0.0.1');
  return once(server, 'listening').then(() => server.address().port);
}

function startContainer() {
  const server = http.createServer((req, res) => {
    const host = req.headers.host;
    if (host !== CONTAINER_NAME) {
      res.writeHead(421, { 'Content-Type': 'text/plain' });
      res.end('unexpected host');
      return;
    }
    if (req.url !== '/app/viewer/' && req.url !== '/app/viewer') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ATTACK_DOCUMENT);
  });
  return listen(server).then(port => ({ server, port }));
}

function proxyToContainer(req, res, containerPort) {
  const publicUrl = new URL(req.url, 'http://127.0.0.1');
  let pathname = publicUrl.pathname;
  if (pathname.startsWith('/api/')) {
    pathname = pathname.slice('/api'.length);
  }
  const match = pathname.match(/^\/proxy\/docker-inference\/([^/]+)\/app\/viewer(\/.*)?$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('no proxy route');
    return;
  }
  const containerName = decodeURIComponent(match[1]);
  const upstreamPath = upstreamPathFor(pathname, containerName);
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: containerPort,
      method: req.method,
      path: `${upstreamPath}${publicUrl.search}`,
      headers: { host: containerName },
    },
    upstreamResponse => {
      const headers = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!HOP_BY_HOP.has(name.toLowerCase())) {
          headers[name] = value;
        }
      }
      res.writeHead(upstreamResponse.statusCode || 502, headers);
      upstreamResponse.pipe(res);
    }
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('proxy error');
  });
  upstream.end();
}

function pageHtml(securityCase) {
  return `<!DOCTYPE html>
<html>
<body>
<div id="root"></div>
<script>
  localStorage.setItem('sessionToken', ${JSON.stringify(PLACEHOLDER_SESSION_TOKEN)});
  window.__exfil = [];
  window.__targets = [];
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'exfil') window.__exfil.push(data);
    if (data.type === 'observed-target') window.__targets.push(String(data.targetOrigin));
  });
  (function () {
    var desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get: function () {
        var win = desc.get.call(this);
        if (!win) return win;
        return new Proxy(win, {
          get: function (target, prop) {
            if (prop === 'postMessage') {
              return function (message, targetOrigin) {
                if (message && message.type === 'data') {
                  window.__targets.push(String(targetOrigin));
                }
                return target.postMessage(message, targetOrigin);
              };
            }
            var value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      }
    });
  })();
  window.__SECURITY_CASE = ${JSON.stringify(securityCase)};
</script>
<script src="/harness.js"></script>
</body>
</html>`;
}

function predictData() {
  const body = JSON.parse(
    JSON.stringify({
      success: true,
      message: 'Prediction successful',
      data: { webappPath: WEBAPP_PATH, webappDataBase64: WEBAPP_DATA },
    })
  );
  return body.data;
}

async function buildHarness(apiUrl, esbuild) {
  const outfile = path.join(os.tmpdir(), 'pacs-ai-model-frame-harness.js');
  await esbuild.build({
    absWorkingDir: here,
    entryPoints: [path.join(here, 'harness.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    outfile,
    jsx: 'automatic',
    define: {
      'process.env.APP_PUBLIC_API_URL': JSON.stringify(apiUrl),
      'process.env.NODE_ENV': JSON.stringify('development'),
    },
    alias: {
      '@pacs-ai/ui': path.join(here, 'stubs/ui.js'),
      '@pacs-ai/ui/src/components/SelectSeriesModal/isInferenceSeriesEligible': path.join(
        repoRoot,
        'extensions/pacs-ai-ui/src/components/SelectSeriesModal/isInferenceSeriesEligible.ts'
      ),
      '@pacs-ai/extension-core/src/api/orthancRepository': path.join(
        here,
        'stubs/orthancRepository.js'
      ),
      '@pacs-ai/extension-core/src/api/orthancDTO': path.join(here, 'stubs/emptyModule.js'),
      'react-i18next': path.join(here, 'stubs/i18n.js'),
    },
    plugins: [
      {
        name: 'sibling-stubs',
        setup(build) {
          const stub = (filter, target) => {
            build.onResolve({ filter }, () => ({ path: target }));
          };
          stub(/AddModelFeedback$/, path.join(here, 'stubs/emptyComponent.js'));
          stub(/close-inactive\.png$/, path.join(here, 'stubs/icon.js'));
          stub(/ModelResultRenderer$/, path.join(here, 'stubs/modelResultRenderer.js'));
          stub(/useModelExecutionResultViewer$/, path.join(here, 'stubs/executionResultViewer.js'));
          stub(/ViewerModelResultFeedback$/, path.join(here, 'stubs/emptyComponent.js'));
          stub(/ViewerRunLabels$/, path.join(here, 'stubs/emptyComponent.js'));
        },
      },
    ],
    nodePaths: packageDir('react').map(candidate => path.dirname(candidate)),
  });
  const { readFile, rm } = await import('node:fs/promises');
  const source = await readFile(outfile);
  await rm(outfile);
  return source;
}

async function fetchText(url) {
  const response = await fetch(url);
  const body = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    csp: response.headers.get('content-security-policy'),
    body,
  };
}

async function openCase(page, origin, securityCase) {
  const encoded = encodeURIComponent(JSON.stringify(securityCase));
  await page.goto(`${origin}/?case=${encoded}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('iframe', { timeout: 10000 });
  await page
    .waitForFunction(
      () =>
        window.__exfil.length > 0 || document.querySelector('iframe')?.getAttribute('sandbox') === '',
      null,
      { timeout: 10000 }
    )
    .catch(() => {});
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    if (!iframe) {
      return { missing: true, exfil: window.__exfil, targets: window.__targets };
    }
    const sandboxAttr = iframe.getAttribute('sandbox');
    const tokens = new Set((sandboxAttr ?? '').split(/\s+/).filter(Boolean));
    const unsandboxed = sandboxAttr === null;
    const scripts = unsandboxed || tokens.has('allow-scripts');
    const sameOriginToken = unsandboxed || tokens.has('allow-same-origin');
    const srcdoc = iframe.getAttribute('srcdoc');
    let documentOrigin = null;
    if (srcdoc !== null) {
      documentOrigin = unsandboxed || tokens.has('allow-same-origin') ? location.origin : 'opaque';
    } else if (iframe.src) {
      documentOrigin = new URL(iframe.src, location.href).origin;
    }
    return {
      missing: false,
      sandboxAttr,
      src: iframe.src || null,
      srcdoc: srcdoc !== null,
      scripts,
      sameOriginToken,
      documentOrigin,
      canReadParentStorage: scripts && sameOriginToken && documentOrigin === location.origin,
      exfil: window.__exfil,
      targets: window.__targets,
    };
  });
}

function assertIsolated(name, observed) {
  const failures = [];
  if (observed.missing) {
    failures.push(`${name}: the model frame was not rendered`);
  }
  if (observed.canReadParentStorage) {
    failures.push(
      `${name}: the model document is allowed to script in the viewer origin (sandbox=${JSON.stringify(observed.sandboxAttr)}, documentOrigin=${observed.documentOrigin})`
    );
  }
  const stolen = (observed.exfil || []).some(item => item.value === PLACEHOLDER_SESSION_TOKEN);
  if (stolen) {
    failures.push(`${name}: the model document read localStorage.sessionToken`);
  }
  if (!observed.canReadParentStorage && !stolen && (observed.exfil || []).length === 0 && observed.scripts) {
    failures.push(`${name}: the model document did not report whether it could read the token`);
  }
  return failures;
}

async function main() {
  const esbuild = loadPackage('esbuild');
  const playwright = loadPackage('@playwright/test');
  const container = await startContainer();
  const holder = { bundle: Buffer.from('') };
  const viewer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = url.pathname;
      if (pathname === '/harness.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(holder.bundle);
        return;
      }
      if (pathname === '/' && url.searchParams.has('case')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageHtml(JSON.parse(url.searchParams.get('case'))));
        return;
      }
      if (pathname.startsWith('/api/proxy/docker-inference/')) {
        proxyToContainer(req, res, container.port);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
  const port = await listen(viewer);
  const apiUrl = `http://127.0.0.1:${port}/api`;
  holder.bundle = await buildHarness(apiUrl, esbuild);

  const origin = `http://127.0.0.1:${port}`;
  const iframeUrl = `${apiUrl}/proxy/docker-inference/${CONTAINER_NAME}${WEBAPP_PATH}`;
  const proxied = await fetchText(iframeUrl);
  const direct = await fetchText(`${origin}/app/viewer/`);
  const proxyFailures = [];
  if (proxied.status !== 200 || !proxied.body.includes('localStorage')) {
    proxyFailures.push(
      `proxy did not return the model document (${proxied.status}, ${proxied.contentType})`
    );
  }
  if (proxied.csp) {
    proxyFailures.push(`proxy added Content-Security-Policy: ${proxied.csp}`);
  }
  if (direct.status !== 404) {
    proxyFailures.push(`model document is served without the inference proxy (${direct.status})`);
  }
  if (new URL(iframeUrl).origin !== origin) {
    proxyFailures.push(`iframe URL origin ${new URL(iframeUrl).origin} is not the viewer origin ${origin}`);
  }

  const data = predictData();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => {
    console.error('pageerror', error);
  });
  page.on('console', message => {
    if (message.type() === 'error') {
      console.error('console', message.text());
    }
  });
  await page.addInitScript(() => {
    const original = window.postMessage;
    window.postMessage = function (message, targetOrigin) {
      if (message && typeof message === 'object' && message.type === 'data') {
        try {
          window.parent.postMessage(
            { type: 'observed-target', targetOrigin: String(targetOrigin) },
            '*'
          );
        } catch (e) {}
      }
      return original.apply(this, arguments);
    };
  });

  const htmlBase64 = Buffer.from(ATTACK_DOCUMENT, 'utf8').toString('base64');
  const webapp = await openCase(page, origin, {
    mode: 'webapp',
    containerName: CONTAINER_NAME,
    webappPath: data.webappPath,
    webappDataBase64: data.webappDataBase64,
  });
  const html = await openCase(page, origin, { mode: 'html', htmlBase64 });
  const report = await openCase(page, origin, { mode: 'report', htmlBase64 });
  await browser.close();
  viewer.close();
  container.server.close();

  const failures = [
    ...proxyFailures,
    ...assertIsolated('webapp output modal', webapp),
    ...assertIsolated('HTML output modal', html),
    ...assertIsolated('stored report drawer', report),
  ];
  const targets = webapp.targets || [];
  if (!webapp.missing && targets.length === 0) {
    failures.push('webapp output modal: did not observe postMessage targetOrigin');
  }
  if (targets.some(target => target === '*')) {
    failures.push("webapp output modal: postMessage targetOrigin is '*'");
  }

  console.log(JSON.stringify({ iframeUrl, proxied: { status: proxied.status, csp: proxied.csp }, webapp, html, report }, null, 2));
  if (failures.length) {
    console.error(failures.map(failure => `FAIL ${failure}`).join('\n'));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
