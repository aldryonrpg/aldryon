/**
 * Bun's SQL driver may return a jsonb column already parsed (object/array)
 * or as raw text depending on column/query shape — normalize defensively
 * instead of assuming one or the other.
 */
export function parseJsonbColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}
