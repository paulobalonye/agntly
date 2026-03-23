import { sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';

export interface KycRecord {
  readonly id: string;
  readonly userId: string;
  readonly tier: string;
  readonly status: string;
  readonly fullName: string | null;
  readonly country: string | null;
  readonly dateOfBirth: string | null;
  readonly verifiedAt: string | null;
  readonly rejectedReason: string | null;
  readonly createdAt: string;
}

function mapRow(row: Record<string, unknown>): KycRecord {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    tier: String(row.tier ?? 'none'),
    status: String(row.status ?? 'unverified'),
    fullName: row.full_name ? String(row.full_name) : null,
    country: row.country ? String(row.country) : null,
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    rejectedReason: row.rejected_reason ? String(row.rejected_reason) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

export class KycService {
  constructor(private readonly db: DbConnection) {}

  async getKycStatus(userId: string): Promise<KycRecord | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM kyc_records WHERE user_id = ${userId}::uuid LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Submit Tier 2 KYC (light verification: name, country, DOB).
   */
  async submitTier2(userId: string, data: {
    fullName: string;
    country: string;
    dateOfBirth: string;
  }): Promise<KycRecord> {
    // Upsert KYC record
    await this.db.execute(sql`
      INSERT INTO kyc_records (user_id, tier, status, full_name, country, date_of_birth, verified_at)
      VALUES (${userId}::uuid, 'tier2', 'verified', ${data.fullName}, ${data.country}, ${data.dateOfBirth}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        tier = 'tier2',
        status = 'verified',
        full_name = ${data.fullName},
        country = ${data.country},
        date_of_birth = ${data.dateOfBirth},
        verified_at = NOW(),
        updated_at = NOW()
    `);

    const record = await this.getKycStatus(userId);
    if (!record) throw new Error('KYC record creation failed');
    return record;
  }

  /**
   * Submit Tier 3 KYC (full verification via external provider).
   * Sets status to 'pending' until provider confirms.
   */
  async submitTier3(userId: string, providerId: string): Promise<KycRecord> {
    await this.db.execute(sql`
      INSERT INTO kyc_records (user_id, tier, status, provider_id)
      VALUES (${userId}::uuid, 'tier3', 'pending', ${providerId})
      ON CONFLICT (user_id) DO UPDATE SET
        tier = 'tier3',
        status = 'pending',
        provider_id = ${providerId},
        updated_at = NOW()
    `);

    const record = await this.getKycStatus(userId);
    if (!record) throw new Error('KYC record creation failed');
    return record;
  }

  /**
   * Admin: approve or reject KYC.
   */
  async updateStatus(userId: string, status: 'verified' | 'rejected', reason?: string): Promise<KycRecord | null> {
    await this.db.execute(sql`
      UPDATE kyc_records SET
        status = ${status},
        verified_at = ${status === 'verified' ? sql`NOW()` : sql`NULL`},
        rejected_reason = ${reason ?? null},
        updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);
    return this.getKycStatus(userId);
  }

  /**
   * Check if user has passed KYC for fiat transactions.
   */
  async isVerified(userId: string): Promise<boolean> {
    const record = await this.getKycStatus(userId);
    return record?.status === 'verified';
  }

  /**
   * Admin: list all KYC records.
   */
  async listAll(limit = 50, offset = 0): Promise<{ records: KycRecord[]; total: number }> {
    const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS total FROM kyc_records`);
    const total = (countResult.rows[0] as { total: number })?.total ?? 0;

    const result = await this.db.execute(sql`
      SELECT * FROM kyc_records ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `);
    return { records: (result.rows as Record<string, unknown>[]).map(mapRow), total };
  }
}
