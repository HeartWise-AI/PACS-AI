declare module 'pixelmatch' {
  export default function pixelmatch(
    img1: Uint8Array,
    img2: Uint8Array,
    output: Uint8Array | null,
    width: number,
    height: number,
    options?: { threshold?: number; includeAA?: boolean }
  ): number;
}
