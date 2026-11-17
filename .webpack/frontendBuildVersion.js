const webpack = require('webpack');

const builtAt = new Date().toISOString();
const buildId = process.env.APP_BUILD_ID?.trim() || builtAt;

const frontendBuildMetadata = Object.freeze({
  buildId,
  builtAt,
});

class FrontendBuildVersionPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('FrontendBuildVersionPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'FrontendBuildVersionPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          compilation.emitAsset(
            'version.json',
            new webpack.sources.RawSource(`${JSON.stringify(frontendBuildMetadata, null, 2)}\n`)
          );
        }
      );
    });
  }
}

module.exports = {
  frontendBuildMetadata,
  FrontendBuildVersionPlugin,
};
