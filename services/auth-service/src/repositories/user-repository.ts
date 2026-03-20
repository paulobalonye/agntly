import { eq } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { users } from '../db/schema.js';

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class UserRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: { email: string; passwordHash: string; role?: string }): Promise<UserRow> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        role: (data.role as 'developer' | 'admin') ?? 'developer',
      })
      .returning();
    return row as UserRow;
  }

  async findById(id: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return (row as UserRow) ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return (row as UserRow) ?? null;
  }

  /**
   * INSERT ON CONFLICT(email) DO NOTHING, then SELECT.
   * Safe for magic link auto-create: creates the user if they don't exist,
   * returns the existing user if they do.
   */
  async upsertByEmail(email: string, role?: string): Promise<UserRow> {
    await this.db
      .insert(users)
      .values({
        email,
        passwordHash: '',
        role: (role as 'developer' | 'admin') ?? 'developer',
      })
      .onConflictDoNothing();

    const row = await this.findByEmail(email);
    if (!row) {
      throw new Error(`Failed to upsert user for email: ${email}`);
    }
    return row;
  }
}
