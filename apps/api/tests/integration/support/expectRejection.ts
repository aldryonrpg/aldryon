import { expect } from "bun:test";

/**
 * Workaround for a Bun 1.3.10 hang: `await expect(promise).rejects.toBeInstanceOf(ErrorClass)`
 * intermittently never settles when `promise`'s chain includes a Bun.SQL
 * query (confirmed via a minimal repro — the query completes fine on the
 * Postgres side per `pg_stat_activity`, but the JS promise never resolves
 * inside bun:test's `.rejects` matcher). A plain try/catch avoids whatever
 * internal path triggers it.
 */
export async function expectRejection<T>(
  promise: Promise<unknown>,
  errorClass: new (...args: never[]) => T,
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(errorClass);
    return;
  }
  throw new Error(`Expected promise to reject with ${errorClass.name}, but it resolved`);
}
