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

// src/legacy/ (AIModelButton, ChatBox, ChatButton) is not exported here: it
// still imports from @ohif/app/src and moves to its own package in P2.4/P2.5.
// Until then import it by path, e.g. '@pacs-ai/ui/src/legacy/ChatButton/ChatButton'.

/**
 * Registered in platform/app/pluginConfig.json. It has no OHIF modules; the
 * package exists for the components above.
 */
const pacsAiUiExtension = {
  id,
};

export default pacsAiUiExtension;
