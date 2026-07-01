// =====================================================================
// PREI | Contact matcher
// Maps an email address to a PREI lead/client so Gmail threads can be
// associated with the right CRM record. In production this queries the
// contacts/leads tables (Supabase/Postgres) by normalized email.
// The scaffold uses an injectable seam with a stub implementation.
// =====================================================================
import { Injectable } from '@nestjs/common';

export interface ContactMatch {
  contactId: string;
  type: 'lead' | 'client';
  name: string;
  email: string;
}

@Injectable()
export class ContactMatcherService {
  // TODO: replace with a repository query:
  //   SELECT id, first_name, last_name, email FROM contacts
  //   WHERE tenant_id = :tenant AND lower(email) = lower(:email) AND deleted_at IS NULL
  private readonly seed: ContactMatch[] = [];

  async matchByEmail(email: string): Promise<ContactMatch | null> {
    const normalized = email.trim().toLowerCase();
    return this.seed.find((c) => c.email.toLowerCase() === normalized) ?? null;
  }

  /** Batch match — used to annotate a list of threads efficiently. */
  async matchMany(emails: string[]): Promise<Record<string, ContactMatch>> {
    const out: Record<string, ContactMatch> = {};
    for (const email of emails) {
      const m = await this.matchByEmail(email);
      if (m) out[email.toLowerCase()] = m;
    }
    return out;
  }
}
