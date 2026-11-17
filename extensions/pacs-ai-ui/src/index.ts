import { id } from './id';

export { default as Button, ButtonEnums } from './components/Button';
export type { ButtonProps } from './components/Button';
export { default as Typography } from './components/Typography';
export type { TypographyProps } from './components/Typography';
export { default as AdminTable } from './components/AdminTable';
export { default as ButtonGradient } from './components/ButtonGradient';
export { default as ButtonSecondary } from './components/ButtonSecondary';
export { default as Logo } from './components/Logo';
export { default as Sidebar } from './components/Sidebar';
export { default as SidebarAdmin } from './components/SidebarAdmin';
export { default as StoreFileButton } from './components/StoreFileButton';

/**
 * Registered in platform/app/pluginConfig.json. It has no OHIF modules; the
 * package exists for the components above.
 */
const pacsAiUiExtension = {
  id,
};

export default pacsAiUiExtension;
