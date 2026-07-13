import type { Rng } from "@/domain/shared/Rng";

/** Deterministic Rng for integration tests — returns a fixed queue of values, then repeats the last one. */
export class FakeRng implements Rng {
  private index = 0;

  constructor(private readonly values: number[]) {
    if (values.length === 0) throw new Error("FakeRng needs at least one value");
  }

  int(_min: number, _max: number): number {
    const value = this.values[Math.min(this.index, this.values.length - 1)];
    this.index += 1;
    return value as number;
  }
}
