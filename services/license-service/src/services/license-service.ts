import { sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';

export interface LicenseRow {
  readonly id: string;
  readonly purchaseCode: string;
  readonly buyerEmail: string | null;
  readonly buyerName: string | null;
  readonly domain: string | null;
  readonly licenseType: string;
  readonly envatoBuyer: string | null;
  readonly envatoItemId: string | null;
  readonly status: string;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
  readonly lastCheckedAt: string | null;
  readonly createdAt: string;
}

interface EnvatoVerifyResult {
  valid: boolean;
  buyer?: string;
  licenseType?: string;
  itemId?: string;
  error?: string;
}

export class LicenseService {
  constructor(private readonly db: DbConnection) {}

  /**
   * Verify a purchase code with Envato API and activate for a domain.
   */
  async activate(purchaseCode: string, domain: string): Promise<{ success: boolean; error?: string; license?: LicenseRow }> {
    // Check if purchase code is already activated
    const existing = await this.findByPurchaseCode(purchaseCode);

    if (existing) {
      if (existing.status === 'revoked') {
        return { success: false, error: 'This license has been revoked.' };
      }
      if (existing.domain && existing.domain !== domain) {
        return { success: false, error: `This license is already activated on domain: ${existing.domain}. Deactivate it first to use on a different domain.` };
      }
      if (existing.domain === domain && existing.status === 'active') {
        return { success: true, license: existing };
      }
    }

    // Check if domain already has an active license
    const domainLicense = await this.findByDomain(domain);
    if (domainLicense && domainLicense.purchaseCode !== purchaseCode) {
      return { success: false, error: 'This domain already has a different active license.' };
    }

    // Verify with Envato API
    const envato = await this.verifyWithEnvato(purchaseCode);
    if (!envato.valid) {
      return { success: false, error: envato.error ?? 'Invalid purchase code.' };
    }

    // Activate or update license
    const normalizedDomain = this.normalizeDomain(domain);

    if (existing) {
      await this.db.execute(sql`
        UPDATE licenses
        SET domain = ${normalizedDomain},
            status = 'active',
            activated_at = NOW(),
            deactivated_at = NULL,
            last_checked_at = NOW(),
            envato_buyer = ${envato.buyer ?? null},
            license_type = ${envato.licenseType ?? 'regular'},
            envato_item_id = ${envato.itemId ?? null}
        WHERE purchase_code = ${purchaseCode}
      `);
    } else {
      await this.db.execute(sql`
        INSERT INTO licenses (purchase_code, domain, status, license_type, envato_buyer, envato_item_id, activated_at, last_checked_at)
        VALUES (${purchaseCode}, ${normalizedDomain}, 'active', ${envato.licenseType ?? 'regular'}, ${envato.buyer ?? null}, ${envato.itemId ?? null}, NOW(), NOW())
      `);
    }

    const license = await this.findByPurchaseCode(purchaseCode);
    return { success: true, license: license ?? undefined };
  }

  /**
   * Deactivate a license (frees the domain for reuse on another domain).
   */
  async deactivate(purchaseCode: string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.findByPurchaseCode(purchaseCode);
    if (!existing) {
      return { success: false, error: 'License not found.' };
    }
    if (existing.status === 'revoked') {
      return { success: false, error: 'This license has been revoked and cannot be deactivated.' };
    }

    await this.db.execute(sql`
      UPDATE licenses
      SET domain = NULL,
          status = 'active',
          deactivated_at = NOW()
      WHERE purchase_code = ${purchaseCode}
    `);

    return { success: true };
  }

  /**
   * Verify a domain has a valid active license.
   */
  async verify(domain: string): Promise<{ valid: boolean; license?: LicenseRow; error?: string }> {
    const normalizedDomain = this.normalizeDomain(domain);
    const license = await this.findByDomain(normalizedDomain);

    if (!license) {
      return { valid: false, error: 'No active license found for this domain.' };
    }
    if (license.status !== 'active') {
      return { valid: false, error: `License status: ${license.status}` };
    }

    // Update last checked timestamp
    await this.db.execute(sql`
      UPDATE licenses SET last_checked_at = NOW() WHERE id = ${license.id}::uuid
    `);

    return { valid: true, license };
  }

  /**
   * Admin: create a manual license (promo/free licenses).
   */
  async createManual(data: {
    purchaseCode: string;
    buyerEmail?: string;
    buyerName?: string;
    domain?: string;
    licenseType?: string;
  }): Promise<{ success: boolean; license?: LicenseRow; error?: string }> {
    const existing = await this.findByPurchaseCode(data.purchaseCode);
    if (existing) {
      return { success: false, error: 'A license with this purchase code already exists.' };
    }

    const normalizedDomain = data.domain ? this.normalizeDomain(data.domain) : null;

    await this.db.execute(sql`
      INSERT INTO licenses (purchase_code, buyer_email, buyer_name, domain, license_type, status, activated_at, last_checked_at)
      VALUES (
        ${data.purchaseCode},
        ${data.buyerEmail ?? null},
        ${data.buyerName ?? null},
        ${normalizedDomain},
        ${data.licenseType ?? 'regular'},
        'active',
        ${normalizedDomain ? sql`NOW()` : sql`NULL`},
        NOW()
      )
    `);

    const license = await this.findByPurchaseCode(data.purchaseCode);
    return { success: true, license: license ?? undefined };
  }

  /**
   * Admin: update license details.
   */
  async update(purchaseCode: string, data: {
    buyerEmail?: string;
    buyerName?: string;
    domain?: string;
    licenseType?: string;
    status?: string;
  }): Promise<{ success: boolean; license?: LicenseRow; error?: string }> {
    const existing = await this.findByPurchaseCode(purchaseCode);
    if (!existing) {
      return { success: false, error: 'License not found.' };
    }

    const normalizedDomain = data.domain !== undefined
      ? (data.domain ? this.normalizeDomain(data.domain) : null)
      : existing.domain;

    await this.db.execute(sql`
      UPDATE licenses
      SET
        buyer_email = ${data.buyerEmail ?? existing.buyerEmail ?? null},
        buyer_name = ${data.buyerName ?? existing.buyerName ?? null},
        domain = ${normalizedDomain},
        license_type = ${data.licenseType ?? existing.licenseType},
        status = ${data.status ?? existing.status}
      WHERE purchase_code = ${purchaseCode}
    `);

    const license = await this.findByPurchaseCode(purchaseCode);
    return { success: true, license: license ?? undefined };
  }

  /**
   * Admin: revoke a license.
   */
  async revoke(purchaseCode: string): Promise<{ success: boolean }> {
    await this.db.execute(sql`
      UPDATE licenses
      SET status = 'revoked', deactivated_at = NOW()
      WHERE purchase_code = ${purchaseCode}
    `);
    return { success: true };
  }

  /**
   * Admin: delete a license permanently.
   */
  async deleteLicense(purchaseCode: string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.findByPurchaseCode(purchaseCode);
    if (!existing) {
      return { success: false, error: 'License not found.' };
    }
    await this.db.execute(sql`DELETE FROM licenses WHERE purchase_code = ${purchaseCode}`);
    return { success: true };
  }

  /**
   * Admin: search licenses by domain, email, or purchase code.
   */
  async search(query: string, limit = 50): Promise<LicenseRow[]> {
    const pattern = `%${query}%`;
    const result = await this.db.execute(sql`
      SELECT * FROM licenses
      WHERE purchase_code ILIKE ${pattern}
        OR domain ILIKE ${pattern}
        OR buyer_email ILIKE ${pattern}
        OR buyer_name ILIKE ${pattern}
        OR envato_buyer ILIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return (result.rows as Record<string, unknown>[]).map(this.mapRow);
  }

  /**
   * Admin: list all licenses.
   */
  async listAll(limit = 50, offset = 0): Promise<{ licenses: LicenseRow[]; total: number }> {
    const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS total FROM licenses`);
    const total = (countResult.rows[0] as { total: number })?.total ?? 0;

    const result = await this.db.execute(sql`
      SELECT id, purchase_code, buyer_email, buyer_name, domain, license_type,
             envato_buyer, envato_item_id, status, activated_at, deactivated_at,
             last_checked_at, created_at
      FROM licenses
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const licenses = (result.rows as Record<string, unknown>[]).map(this.mapRow);
    return { licenses, total };
  }

  async findByPurchaseCode(code: string): Promise<LicenseRow | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM licenses WHERE purchase_code = ${code} LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }

  async findByDomain(domain: string): Promise<LicenseRow | null> {
    const normalized = this.normalizeDomain(domain);
    const result = await this.db.execute(sql`
      SELECT * FROM licenses WHERE domain = ${normalized} AND status = 'active' LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }

  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .split('/')[0]
      .split(':')[0];
  }

  private async verifyWithEnvato(purchaseCode: string): Promise<EnvatoVerifyResult> {
    const token = process.env.ENVATO_PERSONAL_TOKEN;

    // If no Envato token configured, accept any well-formatted code (dev mode)
    if (!token) {
      const codePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!codePattern.test(purchaseCode)) {
        return { valid: false, error: 'Invalid purchase code format. Expected UUID format.' };
      }
      return { valid: true, buyer: 'dev-mode', licenseType: 'regular', itemId: 'dev' };
    }

    try {
      const res = await fetch(
        `https://api.envato.com/v3/market/author/sale?code=${encodeURIComponent(purchaseCode)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        if (res.status === 404) return { valid: false, error: 'Purchase code not found on Envato.' };
        return { valid: false, error: `Envato API error: ${res.status}` };
      }

      const data = await res.json() as Record<string, unknown>;
      const item = data.item as Record<string, unknown> | undefined;

      return {
        valid: true,
        buyer: String(data.buyer ?? ''),
        licenseType: String(data.license ?? 'regular'),
        itemId: item ? String(item.id ?? '') : '',
      };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Envato verification failed.' };
    }
  }

  private mapRow(row: Record<string, unknown>): LicenseRow {
    return {
      id: String(row.id ?? ''),
      purchaseCode: String(row.purchase_code ?? ''),
      buyerEmail: row.buyer_email ? String(row.buyer_email) : null,
      buyerName: row.buyer_name ? String(row.buyer_name) : null,
      domain: row.domain ? String(row.domain) : null,
      licenseType: String(row.license_type ?? 'regular'),
      envatoBuyer: row.envato_buyer ? String(row.envato_buyer) : null,
      envatoItemId: row.envato_item_id ? String(row.envato_item_id) : null,
      status: String(row.status ?? 'active'),
      activatedAt: row.activated_at ? String(row.activated_at) : null,
      deactivatedAt: row.deactivated_at ? String(row.deactivated_at) : null,
      lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
      createdAt: String(row.created_at ?? ''),
    };
  }
}
