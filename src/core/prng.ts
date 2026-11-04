/**
 * Deterministic randomness (SPEC Section 7).
 *
 * cyrb128 hashes a string to four 32-bit words; sfc32 turns those into a
 * uniform [0,1) generator. Every random decision uses a stream derived from a
 * path, so changing one axis rule never shifts another axis' draws.
 */

/** cyrb128 string hash -> 4 x 32-bit unsigned words. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export interface Flux {
  /** next uniform value in [0,1) */
  suivant(): number;
}

/** sfc32 generator seeded from four 32-bit words. */
export function sfc32(a: number, b: number, c: number, d: number): Flux {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return {
    suivant(): number {
      s0 >>>= 0;
      s1 >>>= 0;
      s2 >>>= 0;
      s3 >>>= 0;
      let t = (s0 + s1) | 0;
      s0 = s1 ^ (s1 >>> 9);
      s1 = (s2 + (s2 << 3)) | 0;
      s2 = (s2 << 21) | (s2 >>> 11);
      s3 = (s3 + 1) | 0;
      t = (t + s3) | 0;
      s2 = (s2 + t) | 0;
      return (t >>> 0) / 4294967296;
    },
  };
}

/** Path-derived stream: hash of `seed + "|" + path.join("/")` (SPEC Section 7). */
export function stream(seed: string, ...path: string[]): Flux {
  const [a, b, c, d] = cyrb128(`${seed}|${path.join('/')}`);
  const f = sfc32(a, b, c, d);
  // Discard a short warm-up so that neighbouring paths decorrelate quickly.
  for (let i = 0; i < 8; i++) f.suivant();
  return f;
}
