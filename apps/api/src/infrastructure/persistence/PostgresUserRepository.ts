import type { SQL } from "bun";
import { User } from "@/domain/user/User";
import type { UserRepository } from "@/usecase/user/UserRepository";

interface UserRow {
  id: string;
  external_auth_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

function toDomain(row: UserRow): User {
  return User.create({
    id: row.id,
    externalAuthId: row.external_auth_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  });
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: SQL) {}

  async findByExternalAuthId(externalAuthId: string): Promise<User | null> {
    const rows = await this.sql<
      UserRow[]
    >`select * from users where external_auth_id = ${externalAuthId} limit 1`;

    return rows[0] ? toDomain(rows[0]) : null;
  }

  async upsert(user: User): Promise<User> {
    const props = user.toProps();

    const rows = await this.sql<UserRow[]>`
      insert into users (id, external_auth_id, email, display_name, avatar_url, updated_at)
      values (
        ${props.id}, ${props.externalAuthId}, ${props.email}, ${props.displayName},
        ${props.avatarUrl}, now()
      )
      on conflict (external_auth_id)
      do update set
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now()
      returning *
    `;

    const saved = rows[0];
    if (!saved) {
      throw new Error("Failed to upsert user: no row returned");
    }

    return toDomain(saved);
  }
}
