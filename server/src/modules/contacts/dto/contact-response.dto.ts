// =====================================================================
// PREI | ContactResponse — API sözleşmesi (dış yüzey), snake→camel.
// Frontend ContactDTO bununla birebir senkron (OV-8).
// =====================================================================
import type { ContactRow } from '../contacts.repository';

export interface ContactResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferredLang: string;
  marketingConsent: boolean;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function toContactResponse(row: ContactRow): ContactResponse {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? null,
    fullName,
    email: row.email ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    preferredLang: row.preferred_lang,
    marketingConsent: row.marketing_consent,
    notes: row.notes ?? null,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
