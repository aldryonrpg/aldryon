import type { Rng } from "@/domain/shared/Rng";

/** Math.random-backed Rng for production use. */
export class RandomRng implements Rng {
  int(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
