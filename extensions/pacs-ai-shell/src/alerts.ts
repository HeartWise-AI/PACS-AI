import type { Context } from 'react';
import { AlertContext as CoreAlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';

/** Shows a banner alert: message and variant ('error', 'success' or other). */
export type ShowAlert = (message: string, variant: string) => void;

/**
 * Core's alert context (AlertProvider), typed for the shell's pages. The same
 * context object; only the type differs.
 */
export const AlertContext = CoreAlertContext as unknown as Context<ShowAlert>;
