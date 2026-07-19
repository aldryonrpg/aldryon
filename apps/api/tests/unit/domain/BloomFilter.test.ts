import { describe, expect, it } from "bun:test";
import { BloomFilter } from "@/domain/shared/BloomFilter";

describe("BloomFilter", () => {
  it("never reports a false negative for an added value", () => {
    const filter = new BloomFilter(1000, 0.01);
    const values = Array.from({ length: 500 }, (_, i) => `player-${i}`);
    for (const value of values) filter.add(value);

    for (const value of values) {
      expect(filter.mightContain(value)).toBe(true);
    }
  });

  it("reports nothing as present in an empty filter", () => {
    const filter = new BloomFilter(1000, 0.01);
    expect(filter.mightContain("nobody")).toBe(false);
    expect(filter.mightContain("")).toBe(false);
  });

  it("does not flag a value that was never added, in the common case", () => {
    const filter = new BloomFilter(1000, 0.01);
    filter.add("dragonslayer99");
    expect(filter.mightContain("someone-else")).toBe(false);
  });

  it("keeps the false-positive rate roughly within the configured bound at scale", () => {
    const expectedItems = 5000;
    const falsePositiveRate = 0.01;
    const filter = new BloomFilter(expectedItems, falsePositiveRate);

    for (let i = 0; i < expectedItems; i++) filter.add(`added-${i}`);

    let falsePositives = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      if (filter.mightContain(`not-added-${i}`)) falsePositives++;
    }

    // Generous slack (3x the configured rate) since this is a probabilistic
    // property, not an exact bound — the point is "sane order of magnitude",
    // not pinning the precise math.
    expect(falsePositives / trials).toBeLessThan(falsePositiveRate * 3);
  });
});
