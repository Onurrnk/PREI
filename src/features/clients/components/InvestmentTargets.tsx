// =====================================================================
// PREI | InvestmentTargets — kişinin yatırım hedefleri (ülke + bölge).
//
// Eskiden "tercih edilen bölgeler" serbest metin etiketlerdi: "Dubai",
// "dubai", "BAE" ayrı ayrı kaydolup hiçbir soruyu cevaplayamıyordu.
// Artık ülke LİSTEDEN seçilir (ISO koduna indirgenir), bölge ve ilçe
// serbest kalır. Böylece "İspanya'da kim arıyor" sorgulanabilir.
// =====================================================================
import React, { useState } from 'react';
import type { InvestmentTargetDTO } from '../../../core/types';
import { contactsApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { Button } from '../../../core/components/Button/Button';
import { Modal } from '../../../core/components/Modal/Modal';
import { Field, Input, Select } from '../../../core/components/Form/Form';
import { Plus, Trash, Warning, MapPin } from '@phosphor-icons/react';
import styles from './InvestmentTargets.module.css';

export interface InvestmentTargetsProps {
  contactId: string;
  /** Salt okuma (ör. aday kartında özet gösterimi). */
  readOnly?: boolean;
}

export const InvestmentTargets: React.FC<InvestmentTargetsProps> = ({ contactId, readOnly }) => {
  const toast = useToast();
  const { data, refetch } = useFetch<InvestmentTargetDTO[]>(
    () => contactsApi.investmentTargets(contactId), [contactId]);
  const { data: countries } = useFetch<Array<{ code: string; name: string }>>(
    () => contactsApi.investmentCountries(), []);

  const targets = data ?? [];
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!country) { toast.error('Ülke seçin.'); return; }
    setSaving(true);
    try {
      await contactsApi.addInvestmentTarget(contactId, { country, region, district });
      toast.success('Yatırım hedefi eklendi');
      setOpen(false);
      setCountry(''); setRegion(''); setDistrict('');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: InvestmentTargetDTO) => {
    try {
      await contactsApi.removeInvestmentTarget(t.id);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>Yatırım hedefleri (ülke · bölge)</span>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Plus size={13} style={{ marginRight: 4 }} /> Ekle
          </Button>
        )}
      </div>

      {targets.length === 0 ? (
        <p className={styles.empty}>
          Hedef girilmedi — müşterinin hangi ülke ve bölgeye yatırım yapmak
          istediği kayıtlı değil.
        </p>
      ) : (
        <ul className={styles.list}>
          {targets.map((t) => (
            <li key={t.id} className={styles.item}>
              <MapPin size={13} className={styles.pin} />
              <span className={styles.country}>{t.countryName}</span>
              {t.region && <span className={styles.region}>· {t.region}</span>}
              {t.district && <span className={styles.district}>· {t.district}</span>}
              {/* Eylül'ün çıkardığı hedefler işaretli: kaynağı belli olsun. */}
              {t.source === 'eylul' && <span className={styles.srcBadge}>Eylül</span>}
              {t.warning && (
                <span className={styles.warn} title={t.warning}>
                  <Warning size={12} /> {t.warning}
                </span>
              )}
              {!readOnly && (
                <button className={styles.del} title="Kaldır" onClick={() => remove(t)}>
                  <Trash size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Yatırım hedefi ekle"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button variant="primary" onClick={add} disabled={saving || !country}>
              {saving ? 'Ekleniyor…' : 'Ekle'}
            </Button>
          </>
        }
      >
        <Field label="Ülke">
          {/* Serbest yazım yok: aynı ülkenin üç yazımı sorunu buradan doğuyordu. */}
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Ülke seçin</option>
            {(countries ?? []).map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bölge / şehir">
          <Input
            value={region}
            placeholder="Dubai Marina, İstanbul…"
            onChange={(e) => setRegion(e.target.value)}
          />
        </Field>
        <Field label="İlçe / semt">
          <Input
            value={district}
            placeholder="Nişantaşı…"
            onChange={(e) => setDistrict(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
};
