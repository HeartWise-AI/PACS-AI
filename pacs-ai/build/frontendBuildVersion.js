const builtAt = new Date().toISOString();
const buildId = process.env.APP_BUILD_ID?.trim() || builtAt;

const frontendBuildMetadata = Object.freeze({
  buildId,
  builtAt,
});

class FrontendBuildVersionPlugin {
  apply(compiler) {
    // The bundler's own API (rspack or webpack), so this plugin needs no
    // dependency on either package.
    const { Compilation, sources } = compiler.webpack || compiler.rspack;
    compiler.hooks.thisCompilation.tap('FrontendBuildVersionPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'FrontendBuildVersionPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          compilation.emitAsset(
            'version.json',
            new sources.RawSource(`${JSON.stringify(frontendBuildMetadata, null, 2)}\n`)
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
