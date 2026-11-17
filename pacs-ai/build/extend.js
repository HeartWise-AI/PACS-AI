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
 * to use. Plugins are found by constructor name so this module does not depend
 * on resolving the same plugin packages as the upstream file.
 */
const fs = require('fs');
const path = require('path');
const { frontendBuildMetadata, FrontendBuildVersionPlugin } = require('./frontendBuildVersion');

const REPO_ROOT = path.resolve(__dirname, '../..');
const APP_DIR = path.join(REPO_ROOT, 'platform/app');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const PACS_AI_DIR = path.resolve(__dirname, '..');
// Files that replace upstream ones at the same URL (favicons). OHIF copies an
// extension's public/ folder into the build (writePluginImportsFile.js).
const THEME_PUBLIC_DIR = path.join(REPO_ROOT, 'extensions/pacs-ai-theme/public');
const isThemePublicPattern = pattern =>
  pattern &&
  typeof pattern.from === 'string' &&
  /[\\/]@pacs-ai[\\/]theme[\\/]public[\\/]?$/.test(pattern.from);

/** Build-time values the app reads as process.env.* (see webpack DefinePlugin). */
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

// DefinePlugin instances created by webpack.base.js (see extendWebpackPwa).
const baseDefinePlugins = new WeakSet();

function extendWebpackBase(config, { defineValues } = {}) {
  // Add to upstream's DefinePlugin (it keeps a reference to defineValues), so
  // the result is the same as if the values were in upstream's table.
  const definePlugin = config.plugins.find(p => pluginName(p) === 'DefinePlugin');
  if (definePlugin) {
    baseDefinePlugins.add(definePlugin);
  }
  Object.assign(definePlugin ? definePlugin.definitions : defineValues, pacsAiDefineValues());
  return config;
}

/**
 * dotenv-webpack 1.x returns a webpack DefinePlugin from its constructor.
 * Build one that also reads platform/app/.env.example as defaults.
 */
function createDotenvPlugin() {
  const Dotenv = require(require.resolve('dotenv-webpack', { paths: [APP_DIR] }));
  const dotenv = new Dotenv({ defaults: path.join(APP_DIR, '.env.example') });
  // APP_PUBLIC_TURNSTILE_SITE_KEY comes from pacsAiDefineValues() so Docker/CI
  // can pass it without exposing every variable of the build environment.
  delete dotenv.definitions['process.env.APP_PUBLIC_TURNSTILE_SITE_KEY'];
  return dotenv;
}

function extendWebpackPwa(config) {
  config.plugins = config.plugins.flatMap(plugin => {
    switch (pluginName(plugin)) {
      case 'DefinePlugin':
        // The one not from webpack.base.js is upstream's `new Dotenv()`.
        return [baseDefinePlugins.has(plugin) ? plugin : createDotenvPlugin()];
      case 'CopyPlugin': {
        // Our favicons have the same names as upstream's in platform/app/public.
        // CopyPlugin keeps whichever copy finishes first unless a pattern is
        // forced; a higher priority is written later, so ours always win.
        plugin.patterns.filter(isThemePublicPattern).forEach(p => {
          p.force = true;
          p.priority = 1;
        });
        const ours = pacsAiAppConfigPath();
        if (ours) {
          plugin.patterns
            .filter(p => typeof p.to === 'string' && p.to.endsWith('/app-config.js'))
            .forEach(p => {
              p.from = ours;
            });
        }
        return [plugin];
      }
      case 'InjectManifest':
        // No service worker: public/sw.js is a kill switch, and version.json
        // drives the in-app update monitor instead.
        return [new FrontendBuildVersionPlugin()];
      case 'MiniCssExtractPlugin':
        return [
          new plugin.constructor({
            filename: '[name].bundle.[contenthash].css',
            chunkFilename: '[id].[contenthash].css',
          }),
        ];
      default:
        return [plugin];
    }
  });

  if (!config.plugins.some(p => pluginName(p) === 'FrontendBuildVersionPlugin')) {
    // InjectManifest is absent in coverage builds.
    const cssIndex = config.plugins.findIndex(p => pluginName(p) === 'MiniCssExtractPlugin');
    config.plugins.splice(
      cssIndex === -1 ? config.plugins.length : cssIndex,
      0,
      new FrontendBuildVersionPlugin()
    );
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
    'process.env.APP_BUILD_ID': JSON.stringify(frontendBuildMetadata.buildId),
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
  return config;
}

module.exports = {
  extendRsbuild,
  extendWebpackBase,
  extendWebpackPwa,
  pacsAiAppConfigPath,
  pacsAiDefineValues,
};
