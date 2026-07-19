// =====================================================================
// PREI | ClientForm — ortak müşteri formu (Onur: "kayıt ekranı ile profil
// düzenleme ekranı TUTARLI olsun"). Hem ClientsList "Yeni Müşteri Ekle"
// modalı hem ClientProfile "Profili Düzenle" modalı bu bileşeni kullanır;
// alan seti bire bir aynıdır.
// Bütçe: min/max AYRI, döviz seçilebilir, binlik ayraçlı giriş (1.250.000).
// =====================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnvelopeSimple, BuildingOffice, CurrencyDollar, MapPin } from '@phosphor-icons/react';
import { Field, Input, Textarea, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { contactsApi, type DuplicateMatch } from '../../core/api/resources';
import styles from './ClientProfile.module.css';

export const UNIT_TYPE_OPTIONS = ['Studio', '1+1', '2+1', '3+1', '4+1+', 'Penthouse', 'Villa'];
export const BUDGET_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];

export interface ClientFormValue {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  source: string;
  type: string;               // Individual | Corporate | VIP
  relationshipStatus: string; // Active | Dormant | Churned
  investmentProfile: string;  // Conservative | Balanced | Aggressive
  assignedConsultant: string;
  preferredRegions: string[];
  unitTypes: string[];
  purpose: string;            // Investment | End-use | Golden Visa | Relocation
  budgetMin: string;          // yalnız rakam (görüntüde binlik ayraçlı)
  budgetMax: string;
  budgetCurrency: string;
  requirements: string;
}

export const emptyClientForm: ClientFormValue = {
  name: '', email: '', phone: '', nationality: '', source: 'Website',
  type: 'Individual', relationshipStatus: 'Active', investmentProfile: 'Balanced',
  assignedConsultant: '', preferredRegions: [], unitTypes: [],
  purpose: 'Investment', budgetMin: '', budgetMax: '', budgetCurrency: 'EUR',
  requirements: '',
};

const digitsOnly = (s: string): string => s.replace(/\D/g, '');
const fmtThousands = (s: string): string => (s === '' ? '' : Number(s).toLocaleString('tr-TR'));

// Bölge chip editörü (ClientProfile'daki ile aynı davranış; ortak kullanım için burada).
export const RegionsChipEditor: React.FC<{
  regions: string[];
  onChange: (regions: string[]) => void;
}> = ({ regions, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <div className={styles.regionsList}>
      {regions.map((region) => (
        <span key={region} className={styles.regionTag}>
          <MapPin size={10} /> {region}
          <button type="button" className={styles.regionRemove} aria-label={`Remove ${region}`}
            onClick={() => onChange(regions.filter(r => r !== region))}>×</button>
        </span>
      ))}
      {draft === null ? (
        <button type="button" className={styles.regionAdd} onClick={() => setDraft('')}>
          {t('clients.profile.addRegion')}
        </button>
      ) : (
        <input autoFocus className={styles.regionInput} value={draft}
          placeholder={t('clients.profile.newRegionPh')} aria-label="new region"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null);
            if (e.key === 'Enter') {
              const v = draft.trim();
              if (v && !regions.includes(v)) onChange([...regions, v]);
              setDraft(null);
            }
          }}
        />
      )}
    </div>
  );
};

export const ClientForm: React.FC<{
  value: ClientFormValue;
  onChange: (v: ClientFormValue) => void;
  /** Yeni kayıt modunda (ClientsList "Yeni Müşteri Ekle") duplicate ön-kontrolü
   *  aç: e-posta/telefon girilince "bu kişi zaten kayıtlı" uyarısı. Düzenlemede
   *  kapalı (kendini eşleştirmesin). */
  duplicateCheck?: boolean;
}> = ({ value, onChange, duplicateCheck }) => {
  const { t, i18n } = useTranslation();
  const tr = i18n.language === 'tr';
  const set = (patch: Partial<ClientFormValue>) => onChange({ ...value, ...patch });

  const [dupMatch, setDupMatch] = React.useState<DuplicateMatch | null>(null);
  // Debounce: kullanıcı yazmayı bıraktıktan ~500ms sonra e-posta/telefonla
  // duplicate ön-kontrolü. Effect deps'ten hep GÜNCEL değeri okur (blur'ın
  // stale-closure sorunu yok). Yalnız yeni-kayıt modunda (duplicateCheck).
  React.useEffect(() => {
    if (!duplicateCheck) return;
    const email = value.email.trim();
    const phone = value.phone.trim();
    if (!email && !phone) { setDupMatch(null); return; }
    const id = setTimeout(async () => {
      try {
        const res = await contactsApi.lookup(email || undefined, phone || undefined);
        setDupMatch(res.match);
      } catch { /* sessiz — uyarı best-effort */ }
    }, 500);
    return () => clearTimeout(id);
  }, [duplicateCheck, value.email, value.phone]);

  return (
    <div className={styles.editSections}>
      <section className={styles.editSection}>
        <h4 className={styles.editSectionTitle}><EnvelopeSimple size={13} /> {t('clients.profile.sections.identity')}</h4>
        {dupMatch && (
          <div style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: '0.8125rem',
            background: 'color-mix(in srgb, var(--data-warning) 13%, transparent)',
            color: 'var(--data-warning)', border: '1px solid color-mix(in srgb, var(--data-warning) 35%, transparent)',
          }}>
            {tr
              ? <>⚠ Bu {dupMatch.matchedBy} zaten kayıtlı: <strong>{dupMatch.fullName}</strong>. Kaydedersen yeni kayıt açılmaz, mevcut dosyaya eklenir.</>
              : <>⚠ This {dupMatch.matchedBy === 'e-posta' ? 'email' : 'phone'} already exists: <strong>{dupMatch.fullName}</strong>. Saving will attach to the existing file, not create a new one.</>}
          </div>
        )}
        <Field label={t('clients.profile.fields.fullName')}>
          <Input value={value.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <FormRow>
          <Field label={t('clients.profile.fields.email')}>
            <Input type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label={t('clients.profile.fields.phone')}>
            <Input type="tel" value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('clients.profile.fields.nationality')}>
            <Input value={value.nationality} onChange={(e) => set({ nationality: e.target.value })} />
          </Field>
          <Field label={t('clients.profile.fields.source')}>
            <Input value={value.source} onChange={(e) => set({ source: e.target.value })} />
          </Field>
        </FormRow>
      </section>

      <section className={styles.editSection}>
        <h4 className={styles.editSectionTitle}><BuildingOffice size={13} /> {t('clients.profile.sections.classification')}</h4>
        <FormRow>
          <Field label={t('clients.profile.fields.clientType')}>
            <SelectMenu
              aria-label={t('clients.profile.fields.clientType')}
              value={value.type}
              onChange={(v) => set({ type: v })}
              options={[
                { value: 'Individual', label: t('clients.profile.types.individual') },
                { value: 'Corporate', label: t('clients.profile.types.corporate') },
                { value: 'VIP', label: t('clients.profile.types.vip') },
              ]}
            />
          </Field>
          <Field label={t('clients.profile.fields.relationshipStatus')}>
            <SelectMenu
              aria-label={t('clients.profile.fields.relationshipStatus')}
              value={value.relationshipStatus}
              onChange={(v) => set({ relationshipStatus: v })}
              options={[
                { value: 'Active', label: t('clients.profile.statuses.active') },
                { value: 'Dormant', label: t('clients.profile.statuses.dormant') },
                { value: 'Churned', label: t('clients.profile.statuses.churned') },
              ]}
            />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('clients.profile.fields.riskProfile')}>
            <SelectMenu
              aria-label={t('clients.profile.fields.riskProfile')}
              value={value.investmentProfile}
              onChange={(v) => set({ investmentProfile: v })}
              options={[
                { value: 'Conservative', label: t('clients.profile.riskLevels.conservative') },
                { value: 'Balanced', label: t('clients.profile.riskLevels.balanced') },
                { value: 'Aggressive', label: t('clients.profile.riskLevels.aggressive') },
              ]}
            />
          </Field>
          <Field label={t('clients.profile.fields.assignedConsultant')}>
            <Input value={value.assignedConsultant} onChange={(e) => set({ assignedConsultant: e.target.value })} />
          </Field>
        </FormRow>
      </section>

      <section className={styles.editSection}>
        <h4 className={styles.editSectionTitle}><CurrencyDollar size={13} /> {t('clients.profile.criteria')}</h4>
        <Field label={t('clients.profile.unitTypeSearch')}>
          <div className={styles.unitChipRow}>
            {UNIT_TYPE_OPTIONS.map((u) => {
              const active = value.unitTypes.includes(u);
              return (
                <button key={u} type="button"
                  className={`${styles.unitChip} ${active ? styles.unitChipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => set({ unitTypes: active ? value.unitTypes.filter(x => x !== u) : [...value.unitTypes, u] })}>
                  {u}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t('clients.profile.purpose')}>
          <SelectMenu
            aria-label={t('clients.profile.purpose')}
            value={value.purpose}
            onChange={(v) => set({ purpose: v })}
            options={[
              { value: 'Investment', label: t('clients.profile.purposes.investment') },
              { value: 'End-use', label: t('clients.profile.purposes.endUse') },
              { value: 'Golden Visa', label: t('clients.profile.purposes.goldenVisa') },
              { value: 'Relocation', label: t('clients.profile.purposes.relocation') },
            ]}
          />
        </Field>
        {/* Bütçe — min/max AYRI + döviz; binlik ayraçlı (Onur talebi) */}
        <FormRow>
          <Field label={t('clients.profile.fields.budgetMin')}>
            <Input inputMode="numeric" placeholder="500.000"
              value={fmtThousands(digitsOnly(value.budgetMin))}
              onChange={(e) => set({ budgetMin: digitsOnly(e.target.value) })} />
          </Field>
          <Field label={t('clients.profile.fields.budgetMax')}>
            <Input inputMode="numeric" placeholder="1.250.000"
              value={fmtThousands(digitsOnly(value.budgetMax))}
              onChange={(e) => set({ budgetMax: digitsOnly(e.target.value) })} />
          </Field>
          <Field label={t('clients.profile.fields.budgetCurrency')}>
            <SelectMenu
              aria-label={t('clients.profile.fields.budgetCurrency')}
              value={value.budgetCurrency}
              onChange={(v) => set({ budgetCurrency: v })}
              options={BUDGET_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </FormRow>
        <Field label={t('clients.profile.requirements')}>
          <Textarea rows={3} placeholder={t('clients.profile.fields.requirementsPh')}
            value={value.requirements}
            onChange={(e) => set({ requirements: e.target.value })} />
        </Field>
      </section>

      <section className={styles.editSection}>
        <h4 className={styles.editSectionTitle}><MapPin size={13} /> {t('clients.profile.sections.preferredLocations')}</h4>
        <RegionsChipEditor
          regions={value.preferredRegions}
          onChange={(regions) => set({ preferredRegions: regions })}
        />
      </section>
    </div>
  );
};

/** Form değerinden PATCH /api/clients gövdesi üretir (yalnız dolu alanlar). */
export function clientFormToPatch(v: ClientFormValue): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: v.name.trim(),
    type: v.type,
    relationshipStatus: v.relationshipStatus,
    investmentProfile: v.investmentProfile,
    purpose: v.purpose,
    preferredRegions: v.preferredRegions,
    unitTypes: v.unitTypes,
  };
  if (v.email.trim()) patch.email = v.email.trim();
  if (v.phone.trim()) patch.phone = v.phone.trim();
  if (v.nationality.trim()) patch.nationality = v.nationality.trim();
  if (v.source.trim()) patch.source = v.source.trim();
  if (v.assignedConsultant.trim()) patch.assignedConsultant = v.assignedConsultant.trim();
  if (v.requirements.trim()) patch.requirements = v.requirements.trim();
  if (v.budgetMin) patch.budgetMin = Number(v.budgetMin);
  if (v.budgetMax) patch.budgetMax = Number(v.budgetMax);
  if (v.budgetMin || v.budgetMax) patch.budgetCurrency = v.budgetCurrency;
  return patch;
}
