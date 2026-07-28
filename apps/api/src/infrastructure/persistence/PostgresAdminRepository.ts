import type { SQL } from "bun";
import type { AdminRepository } from "@/usecase/admin/AdminRepository";

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly sql: SQL) {}

  async isAdmin(userId: string): Promise<boolean> {
    const rows = await this.sql`select 1 from admins where user_id = ${userId} limit 1`;
    return rows.length > 0;
  }
}
