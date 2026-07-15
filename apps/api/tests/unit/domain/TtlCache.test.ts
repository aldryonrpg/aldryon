import { describe, expect, it } from "bun:test";
import { TtlCache } from "@/domain/shared/TtlCache";

describe("TtlCache", () => {
  it("returns null before anything is set", () => {
    const cache = new TtlCache<number>(1000);
    expect(cache.get()).toBeNull();
  });

  it("returns the cached value within the TTL window", () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, () => now);
    cache.set(42);
    now = 999;
    expect(cache.get()).toBe(42);
  });

  it("expires exactly at the TTL boundary", () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, () => now);
    cache.set(42);
    now = 1000;
    expect(cache.get()).toBeNull();
  });

  it("re-caches a fresh value after a set following expiry", () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, () => now);
    cache.set(1);
    now = 2000;
    expect(cache.get()).toBeNull();
    cache.set(2);
    expect(cache.get()).toBe(2);
  });
});
