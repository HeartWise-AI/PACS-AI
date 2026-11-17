import { id } from './id';

export { default as Button, ButtonEnums } from './components/Button';
export type { ButtonProps } from './components/Button';
export { default as Typography } from './components/Typography';
export type { TypographyProps } from './components/Typography';

/**
 * Registered in platform/app/pluginConfig.json. It has no OHIF modules; the
 * package exists for the components above.
 */
const pacsAiUiExtension = {
  id,
};

export default pacsAiUiExtension;
