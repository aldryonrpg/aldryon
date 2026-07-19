import { SQL } from "bun";

export interface PostgresPoolOptions {
  max: number;
  idleTimeoutSeconds: number;
  maxLifetimeSeconds: number;
  prepare: boolean;
}

export function createPostgresClient(databaseUrl: string, options: PostgresPoolOptions): SQL {
  return new SQL(databaseUrl, {
    max: options.max,
    idleTimeout: options.idleTimeoutSeconds,
    maxLifetime: options.maxLifetimeSeconds,
    prepare: options.prepare,
  });
}
