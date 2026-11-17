/**
 * The chat's series picker is the run-model series picker. It lives with the
 * inference code (platform/app/src/components/inference until P2.4 moves it
 * to @pacs-ai/extension-inference), which the chat package may not import
 * (PLAN.md 6.1: chat imports core and ui only). This file is the only place
 * the chat reaches it, so the import can be repointed in one line when the
 * picker moves (to @pacs-ai/ui, or provided by the inference extension).
 */
export { default } from '@ohif/app/src/components/inference/SelectSeriesModal';
