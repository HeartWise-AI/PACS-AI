// Shared by the predict HTML output modal and the stored-result viewer so
// both decode and sandbox model-generated HTML reports the same way.
export const HTML_REPORT_IFRAME_SANDBOX = 'allow-same-origin allow-scripts';

export function decodeBase64HTML(htmlBase64: string): string {
  // Decode base64 to binary string, then convert to Uint8Array more efficiently
  const binaryString = atob(htmlBase64);
  const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
