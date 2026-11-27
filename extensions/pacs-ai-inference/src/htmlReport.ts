// Shared by every frame that shows model output (the predict HTML output modal,
// the stored-result viewer and the WEB_APP output modal) so all of them decode
// and sandbox model-generated content the same way.
// Never add allow-same-origin: combined with allow-scripts it gives the model's
// document the viewer's origin, and with it the session token and the viewer's DOM.
export const HTML_REPORT_IFRAME_SANDBOX = 'allow-scripts';

// A model web app is a whole page served from the model container through the
// API's docker-inference proxy, which is on the viewer's origin. It keeps the
// report sandbox (opaque origin) and may also submit forms, show dialogs and
// save downloads. No popups: a popup would show model-served pages in a full
// window under the viewer's own URL. Never add allow-same-origin,
// allow-popups-to-escape-sandbox or allow-top-navigation.
export const WEBAPP_IFRAME_SANDBOX = [
  HTML_REPORT_IFRAME_SANDBOX,
  'allow-forms',
  'allow-modals',
  'allow-downloads',
].join(' ');

export function decodeBase64HTML(htmlBase64: string): string {
  // Decode base64 to binary string, then convert to Uint8Array more efficiently
  const binaryString = atob(htmlBase64);
  const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
