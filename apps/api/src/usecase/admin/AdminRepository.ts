/**
 * Port implemented by infrastructure (Postgres) for the `admins` allowlist
 * (plan9 §2). No domain entity backs this — admin status isn't an
 * aggregate with its own invariants, just a flag lookup keyed by user id.
 */
export interface AdminRepository {
  isAdmin(userId: string): Promise<boolean>;
}
