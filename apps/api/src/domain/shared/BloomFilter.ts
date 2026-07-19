/**
 * A probabilistic, string-keyed set: `mightContain` never false-negatives
 * (if `add` was called with a value, it always reports true afterward) but
 * can false-positive at a bounded rate. No removal support — that's a
 * fundamental Bloom filter limitation, not an oversight; callers that need
 * to "free" a value just accept the occasional extra confirmatory lookup
 * (see PlayerNameCache).
 *
 * Sized from the standard formulas for bit-array length `m` and hash count
 * `k` given the expected item count `n` and target false-positive rate `p`:
 *   m = ceil(-(n * ln(p)) / (ln(2)^2))
 *   k = round((m / n) * ln(2))
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly numBits: number;
  private readonly numHashes: number;

  constructor(expectedItems: number, falsePositiveRate: number) {
    const n = Math.max(1, expectedItems);
    const p = falsePositiveRate;
    this.numBits = Math.max(8, Math.ceil((-n * Math.log(p)) / Math.log(2) ** 2));
    this.numHashes = Math.max(1, Math.round((this.numBits / n) * Math.log(2)));
    this.bits = new Uint8Array(Math.ceil(this.numBits / 8));
  }

  add(value: string): void {
    for (const index of this.probeIndexes(value)) {
      this.bits[index >> 3] = (this.bits[index >> 3] ?? 0) | (1 << (index & 7));
    }
  }

  mightContain(value: string): boolean {
    for (const index of this.probeIndexes(value)) {
      if (((this.bits[index >> 3] ?? 0) & (1 << (index & 7))) === 0) return false;
    }
    return true;
  }

  /** Kirsch-Mitzenmacher double hashing: derives `numHashes` probe positions
   * from two independent base hashes instead of computing k real hash
   * functions. */
  private probeIndexes(value: string): number[] {
    const h1 = fnv1a(value, 0x811c9dc5);
    const h2 = fnv1a(value, 0x1000193);
    const indexes: number[] = [];
    for (let i = 0; i < this.numHashes; i++) {
      const combined = (h1 + i * h2) >>> 0;
      indexes.push(combined % this.numBits);
    }
    return indexes;
  }
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
