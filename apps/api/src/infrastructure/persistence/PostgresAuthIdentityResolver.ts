import type { SQL } from "bun";
import type {
  AuthIdentityResolver,
  ResolvedAuthIdentity,
} from "@/usecase/auth/AuthIdentityResolver";

interface ResolvedAuthIdentityRow {
  player_id: string;
}

export class PostgresAuthIdentityResolver implements AuthIdentityResolver {
  constructor(private readonly sql: SQL) {}

  async resolve(externalAuthId: string): Promise<ResolvedAuthIdentity | null> {
    const rows = await this.sql<ResolvedAuthIdentityRow[]>`
      select players.id as player_id
      from users
      join players on players.user_id = users.id
      where users.external_auth_id = ${externalAuthId}
      limit 1
    `;

    const row = rows[0];
    if (!row) return null;
    return { playerId: row.player_id };
  }
}
