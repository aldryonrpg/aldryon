import { describe, expect, it } from "bun:test";
import { KeyedTtlCache, msUntilNextUtcMidnight, TtlCache } from "@/domain/shared/TtlCache";

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

  it("honors a per-set ttl override instead of the constructor's default", () => {
    let now = 0;
    const cache = new TtlCache<number>(1_000_000, () => now);
    cache.set(42, 500);
    now = 499;
    expect(cache.get()).toBe(42);
    now = 500;
    expect(cache.get()).toBeNull();
  });
});

describe("KeyedTtlCache", () => {
  it("returns null for a key that was never set", () => {
    const cache = new KeyedTtlCache<string, number>(1000);
    expect(cache.get("a")).toBeNull();
  });

  it("caches each key independently within the TTL window", () => {
    let now = 0;
    const cache = new KeyedTtlCache<string, number>(1000, () => now);
    cache.set("a", 1);
    cache.set("b", 2);
    now = 999;
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBeNull();
  });

  it("expires each key on its own schedule", () => {
    let now = 0;
    const cache = new KeyedTtlCache<string, number>(1000, () => now);
    cache.set("a", 1);
    now = 500;
    cache.set("b", 2);
    now = 1000;
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
  });

  it("overwrites an existing key's value and resets its expiry", () => {
    let now = 0;
    const cache = new KeyedTtlCache<string, number>(1000, () => now);
    cache.set("a", 1);
    now = 999;
    cache.set("a", 2);
    now = 1998;
    expect(cache.get("a")).toBe(2);
  });
});

describe("msUntilNextUtcMidnight", () => {
  it("returns the ms remaining until the next UTC day boundary", () => {
    const now = Date.UTC(2026, 0, 15, 20, 30, 0); // 2026-01-15T20:30:00Z
    const nextMidnight = Date.UTC(2026, 0, 16, 0, 0, 0);
    expect(msUntilNextUtcMidnight(() => now)).toBe(nextMidnight - now);
  });

  it("returns a full day when called exactly at midnight", () => {
    const now = Date.UTC(2026, 0, 15, 0, 0, 0);
    expect(msUntilNextUtcMidnight(() => now)).toBe(24 * 60 * 60 * 1000);
  });

  it("rolls over correctly at a month/year boundary", () => {
    const now = Date.UTC(2025, 11, 31, 12, 0, 0); // 2025-12-31T12:00:00Z
    const nextMidnight = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(msUntilNextUtcMidnight(() => now)).toBe(nextMidnight - now);
  });
});
