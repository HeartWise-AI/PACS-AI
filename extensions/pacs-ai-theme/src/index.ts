import { id } from './id';

export { colors, primaryGradient } from './tokens';

/**
 * Registered in platform/app/pluginConfig.json so that the files under
 * `public/` (favicons) are copied into the build output at the same paths.
 * It has no OHIF modules.
 */
const pacsAiThemeExtension = {
  id,
};

export default pacsAiThemeExtension;
