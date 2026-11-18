/**
 * PACS-AI build extensions.
 *
 * Upstream build files load this module through one hook each (ledger rows in
 * pacs-ai/UPSTREAM_PATCHES.md):
 *   .webpack/webpack.base.js             -> extendWebpackBase(config, { env, argv, defineValues })
 *   platform/app/.webpack/webpack.pwa.js -> extendWebpackPwa(config, { env, argv })
 *   rsbuild.config.ts                    -> extendRsbuild(config)
 *
 * Each function receives the finished upstream config and returns the config
 * to use. The production build is rspack (OHIF 3.13); plugins are found by
 * constructor name, and new plugins are made with the constructor of the
 * upstream instance, so this module does not depend on resolving the same
 * @rspack/core as the upstream file (the root and platform/app resolve
 * different versions).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { frontendBuildMetadata, FrontendBuildVersionPlugin } = require('./frontendBuildVersion');

const REPO_ROOT = path.resolve(__dirname, '../..');
const APP_DIR = path.join(REPO_ROOT, 'platform/app');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const PACS_AI_DIR = path.resolve(__dirname, '..');
// Files that replace upstream ones at the same URL (favicons). OHIF copies an
// extension's public/ folder into the build (writePluginImportsFile.js).
const THEME_PUBLIC_DIR = path.join(REPO_ROOT, 'extensions/pacs-ai-theme/public');
// Files we serve at the root of the app that replace or add to upstream's
// public/ (the service-worker kill switch: sw.js and init-service-worker.js).
const BUILD_PUBLIC_DIR = path.join(PACS_AI_DIR, 'build/public');
// env-config.js, written by generate-env-config.js before each build (git-ignored).
const GENERATED_ENV_CONFIG = path.join(PACS_AI_DIR, 'build/generated/env-config.js');
// The deployment's build environment (untracked, ledger row 0006) and our
// variables with their defaults.
const APP_ENV_FILE = path.join(APP_DIR, '.env');
const ENV_DEFAULTS_FILE = path.join(PACS_AI_DIR, 'build/env.example');
const APP_TITLE = 'PACS AI Viewer';
const isThemePublicPattern = pattern =>
  pattern &&
  typeof pattern.from === 'string' &&
  // node_modules/@pacs-ai/theme/public (yarn) or the workspace path (pnpm).
  (/[\\/]@pacs-ai[\\/]theme[\\/]public[\\/]?$/.test(pattern.from) ||
    path.resolve(pattern.from) === THEME_PUBLIC_DIR);

/** Build-time values the app reads as process.env.* (see DefinePlugin). */
function pacsAiDefineValues() {
  return {
    'process.env.APP_BUILD_ID': JSON.stringify(frontendBuildMetadata.buildId),
    'process.env.APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED': JSON.stringify(
      process.env.APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED || 'true'
    ),
    'process.env.APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED': JSON.stringify(
      process.env.APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED || 'true'
    ),
    'process.env.APP_PUBLIC_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.APP_PUBLIC_TURNSTILE_SITE_KEY || ''
    ),
  };
}

/**
 * APP_CONFIG names a file relative to platform/app/public (for example
 * config/default.js). Our app configs live in pacs-ai/ under the same relative
 * path (config/pacs-ai.js -> pacs-ai/config/pacs-ai.js). Returns the absolute
 * path of our file when APP_CONFIG names one and upstream has no such file,
 * otherwise null.
 */
function pacsAiAppConfigPath() {
  const appConfig = process.env.APP_CONFIG;
  if (!appConfig || fs.existsSync(path.join(PUBLIC_DIR, appConfig))) {
    return null;
  }
  const ours = path.join(PACS_AI_DIR, appConfig);
  return fs.existsSync(ours) ? ours : null;
}

const pluginName = plugin => plugin && plugin.constructor && plugin.constructor.name;

/** CopyPlugin patterns for our root files; forced and later than upstream's public/ copy. */
function pacsAiPublicPatterns(toDir) {
  return [
    { from: BUILD_PUBLIC_DIR, to: toDir, force: true, priority: 1 },
    {
      from: GENERATED_ENV_CONFIG,
      to: toDir === '.' ? 'env-config.js' : path.join(toDir, 'env-config.js'),
      force: true,
      priority: 1,
      noErrorOnMissing: true,
    },
  ];
}

/**
 * index.html: load env-config.js (window._env_) right before app-config.js,
 * which reads it, and use our title. Upstream's template is left unchanged.
 */
const APP_CONFIG_TAG = /<script\b[^>]*\bsrc="([^"]*)app-config\.js"[^>]*>\s*<\/script>/;
function transformIndexHtml(html) {
  const appConfigTag = html.match(APP_CONFIG_TAG);
  if (!appConfigTag || !/<title>[^<]*<\/title>/.test(html)) {
    throw new Error(
      'pacs-ai/build/extend.js: index.html has no app-config.js script or <title>; update transformIndexHtml'
    );
  }
  const envConfigTag = `<script type="text/javascript" src="${appConfigTag[1]}env-config.js"></script>\n    `;
  return html
    .replace(APP_CONFIG_TAG, tag => envConfigTag + tag)
    .replace(/<title>[^<]*<\/title>/, `<title>${APP_TITLE}</title>`);
}

class PacsAiIndexHtmlPlugin {
  constructor(HtmlPlugin) {
    // HtmlRspackPlugin (getCompilationHooks) or HtmlWebpackPlugin (getHooks).
    this.HtmlPlugin = HtmlPlugin;
  }

  apply(compiler) {
    // rspack checks that the compilation comes from the same @rspack/core copy
    // as the plugin class, and the CLI's copy is not platform/app's: use the
    // compiler's own HtmlRspackPlugin when there is one.
    const HtmlPlugin = (compiler.rspack && compiler.rspack.HtmlRspackPlugin) || this.HtmlPlugin;
    const getHooks = compilation =>
      HtmlPlugin.getCompilationHooks
        ? HtmlPlugin.getCompilationHooks(compilation)
        : HtmlPlugin.getHooks(compilation);
    compiler.hooks.compilation.tap('PacsAiIndexHtmlPlugin', compilation => {
      getHooks(compilation).beforeEmit.tap(
        'PacsAiIndexHtmlPlugin',
        data => {
          if (data.outputName === 'index.html') {
            data.html = transformIndexHtml(data.html);
          }
          return data;
        }
      );
    });
  }
}

const readEnvFile = file => (fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {});

/**
 * process.env.* values from the env files, as dotenv-webpack defined them
 * before OHIF 3.13 dropped it: every variable of platform/app/.env, with
 * pacs-ai/build/env.example supplying the variables .env does not set. Only the
 * files are read, not the build environment (dotenv-webpack's default), except
 * for the values pacsAiDefineValues() takes from it. Keys in `skip` (upstream's
 * own define table) are left to upstream.
 */
function envFileDefineValues(skip = {}) {
  const values = { ...readEnvFile(ENV_DEFAULTS_FILE), ...readEnvFile(APP_ENV_FILE) };
  const defines = {};
  Object.entries(values).forEach(([name, value]) => {
    const key = `process.env.${name}`;
    if (!(key in skip)) {
      defines[key] = JSON.stringify(value);
    }
  });
  return { ...defines, ...pacsAiDefineValues() };
}

function extendWebpackBase(config, { defineValues = {} } = {}) {
  // A second DefinePlugin of the same bundler for our keys; upstream's table
  // (defineValues) keeps its own keys.
  const definePlugin = config.plugins.find(p => pluginName(p) === 'DefinePlugin');
  if (!definePlugin) {
    throw new Error('pacs-ai/build/extend.js: no DefinePlugin in .webpack/webpack.base.js');
  }
  config.plugins.push(new definePlugin.constructor(envFileDefineValues(defineValues)));
  return config;
}

/** The options object of an rspack built-in plugin (CopyRspackPlugin, ...). */
function builtinPluginOptions(plugin) {
  const options = plugin._args && plugin._args[0];
  if (!options) {
    throw new Error(
      `pacs-ai/build/extend.js: cannot read the options of ${pluginName(plugin)}; update builtinPluginOptions`
    );
  }
  return options;
}

function extendWebpackPwa(config) {
  config.plugins = config.plugins.flatMap(plugin => {
    switch (pluginName(plugin)) {
      case 'CopyRspackPlugin': {
        const { patterns } = builtinPluginOptions(plugin);
        // Our favicons have the same names as upstream's in platform/app/public.
        // The copy keeps whichever file comes first unless a pattern is forced;
        // a higher priority is written later, so ours always win.
        patterns.filter(isThemePublicPattern).forEach(p => {
          p.force = true;
          p.priority = 1;
        });
        const appConfigPatterns = patterns.filter(
          p => typeof p.to === 'string' && p.to.endsWith('/app-config.js')
        );
        if (appConfigPatterns.length) {
          patterns.push(...pacsAiPublicPatterns(path.dirname(appConfigPatterns[0].to)));
        }
        const ours = pacsAiAppConfigPath();
        if (ours) {
          appConfigPatterns.forEach(p => {
            p.from = ours;
          });
        }
        return [plugin];
      }
      case 'HtmlRspackPlugin':
        return [plugin, new PacsAiIndexHtmlPlugin(plugin.constructor)];
      case 'InjectServiceWorkerManifestPlugin':
        // No service worker: pacs-ai/build/public/sw.js is a kill switch, and
        // version.json drives the in-app update monitor instead.
        return [new FrontendBuildVersionPlugin()];
      case 'CssExtractRspackPlugin':
        return [
          new plugin.constructor({
            ...plugin.options,
            filename: '[name].bundle.[contenthash].css',
            chunkFilename: '[id].[contenthash].css',
          }),
        ];
      default:
        return [plugin];
    }
  });

  if (!config.plugins.some(p => pluginName(p) === 'FrontendBuildVersionPlugin')) {
    // The service-worker plugin is absent in coverage builds.
    config.plugins.push(new FrontendBuildVersionPlugin());
  }

  config.resolve = config.resolve || {};
  config.resolve.fallback = { ...config.resolve.fallback, os: false, crypto: false };

  if (config.devServer) {
    config.devServer.headers = {
      ...config.devServer.headers,
      'Cross-Origin-Embedder-Policy': '*',
      'Cross-Origin-Opener-Policy': 'same-origin',
    };
  }

  return config;
}

function extendRsbuild(config) {
  config.source = config.source || {};
  config.source.define = {
    ...config.source.define,
    ...envFileDefineValues(config.source.define),
  };

  config.output = config.output || {};
  const copy = config.output.copy || [];
  const ours = pacsAiAppConfigPath();
  if (ours) {
    copy
      .filter(p => p && p.to === 'app-config.js')
      .forEach(p => {
        p.from = ours;
      });
  }
  copy.push(...pacsAiPublicPatterns('.'));
  copy.push({
    from: THEME_PUBLIC_DIR,
    to: '.',
    force: true,
    priority: 1,
  });
  copy.push({
    from: path.join(REPO_ROOT, 'version.json'),
    to: 'version.json',
    transform: () => Buffer.from(`${JSON.stringify(frontendBuildMetadata, null, 2)}\n`),
  });
  config.output.copy = copy;

  config.html = config.html || {};
  const upstreamTags = config.html.tags;
  config.html.tags = [
    ...(Array.isArray(upstreamTags) ? upstreamTags : upstreamTags ? [upstreamTags] : []),
    {
      tag: 'script',
      attrs: { type: 'text/javascript', src: `${process.env.PUBLIC_URL || '/'}env-config.js` },
      head: true,
      append: false,
    },
  ];
  config.html.title = APP_TITLE;
  return config;
}

module.exports = {
  extendRsbuild,
  extendWebpackBase,
  extendWebpackPwa,
  envFileDefineValues,
  pacsAiAppConfigPath,
  pacsAiDefineValues,
  transformIndexHtml,
};
