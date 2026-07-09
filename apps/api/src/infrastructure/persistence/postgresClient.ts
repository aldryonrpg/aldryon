import { SQL } from "bun";

export function createPostgresClient(databaseUrl: string): SQL {
  return new SQL(databaseUrl);
}
