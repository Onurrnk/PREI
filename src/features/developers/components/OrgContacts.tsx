// =====================================================================
// PREI | OrgContacts — firma kişileri (unvanlı).
//
// Bir geliştiricide satış müdürü, mali işler, şantiye şefi ayrı kişiler.
// Eskiden tek "kilit kişi" alanı vardı ve kimin ne olduğu belirsizdi.
// Unvan öne çıkarılır; birincil kişi rozetle işaretlenir (yazışmalarda
// varsayılan muhatap odur).
// =====================================================================
import React, { useState } from 'react';
import type { OrgContactDTO, OrgContactInput } from '../../../core/types';
import { developersApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { Modal } from '../../../core/components/Modal/Modal';
import { Field, Input } from '../../../core/components/Form/Form';
import {
  EnvelopeSimple, Phone, WhatsappLogo, Plus, PencilSimple, Trash, Star,
} from '@phosphor-icons/react';
import styles from './OrgContacts.module.css';

const EMPTY: OrgContactInput = {
  fullName: '', title: '', email: '', phone: '', whatsapp: '', isPrimary: false, notes: '',
};

export interface OrgContactsProps {
  developerId: string;
}

export const OrgContacts: React.FC<OrgContactsProps> = ({ developerId }) => {
  const toast = useToast();
  const { data, refetch } = useFetch<OrgContactDTO[]>(
    () => developersApi.contacts(developerId), [developerId]);
  const contacts = data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgContactDTO | null>(null);
  const [form, setForm] = useState<OrgContactInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrgContactDTO | null>(null);

  const setF = <K extends keyof OrgContactInput>(k: K, v: OrgContactInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    // İlk kişi doğal olarak birincil olsun.
    setForm({ ...EMPTY, isPrimary: contacts.length === 0 });
    setOpen(true);
  };

  const openEdit = (c: OrgContactDTO) => {
    setEditing(c);
    setForm({
      fullName: c.fullName, title: c.title ?? '', email: c.email ?? '',
      phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', isPrimary: c.isPrimary,
      notes: c.notes ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.fullName?.trim()) { toast.error('Ad soyad zorunlu.'); return; }
    setSaving(true);
    try {
      if (editing) await developersApi.updateContact(editing.id, form);
      else await developersApi.addContact(developerId, form);
      toast.success(editing ? 'Kişi güncellendi' : 'Kişi eklendi');
      setOpen(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await developersApi.removeContact(deleteTarget.id);
      toast.success('Kişi silindi');
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  return (
    <Card>
      <CardHeader className={styles.head}>
        <h3 className={styles.cardTitle}>Firma kişileri</h3>
        <Button variant="outline" size="sm" onClick={openNew}>
          <Plus size={14} style={{ marginRight: 4 }} /> Kişi ekle
        </Button>
      </CardHeader>
      <CardBody>
        {contacts.length === 0 ? (
          <p className={styles.empty}>
            Henüz kişi eklenmedi. Firmadaki muhatapları unvanlarıyla ekleyin.
          </p>
        ) : (
          <ul className={styles.list}>
            {contacts.map((c) => (
              <li key={c.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <div>
                    <span className={styles.name}>{c.fullName}</span>
                    {c.isPrimary && (
                      <span className={styles.primaryBadge}>
                        <Star size={10} weight="fill" /> Birincil
                      </span>
                    )}
                    {/* Unvan yoksa uydurmuyoruz — eksik olduğunu söylüyoruz. */}
                    <span className={c.title ? styles.title : styles.titleMissing}>
                      {c.title ?? 'unvan girilmedi'}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <button className={styles.iconBtn} title="Düzenle" onClick={() => openEdit(c)}>
                      <PencilSimple size={14} />
                    </button>
                    <button className={styles.iconBtn} title="Sil" onClick={() => setDeleteTarget(c)}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
                <div className={styles.contactLines}>
                  {c.email && (
                    <a className={styles.line} href={`mailto:${c.email}`}>
                      <EnvelopeSimple size={13} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a className={styles.line} href={`tel:${c.phone}`}>
                      <Phone size={13} /> {c.phone}
                    </a>
                  )}
                  {c.whatsapp && (
                    <span className={styles.line}>
                      <WhatsappLogo size={13} /> {c.whatsapp}
                    </span>
                  )}
                </div>
                {c.notes && <p className={styles.notes}>{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Kişiyi düzenle' : 'Firma kişisi ekle'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      >
        <Field label="Ad soyad">
          <Input value={form.fullName ?? ''} onChange={(e) => setF('fullName', e.target.value)} />
        </Field>
        <Field label="Unvan">
          <Input
            value={form.title ?? ''}
            placeholder="Satış Direktörü"
            onChange={(e) => setF('title', e.target.value)}
          />
        </Field>
        <Field label="E-posta">
          <Input type="email" value={form.email ?? ''} onChange={(e) => setF('email', e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input value={form.phone ?? ''} onChange={(e) => setF('phone', e.target.value)} />
        </Field>
        <Field label="WhatsApp">
          <Input value={form.whatsapp ?? ''} onChange={(e) => setF('whatsapp', e.target.value)} />
        </Field>
        <Field label="Not">
          <Input value={form.notes ?? ''} onChange={(e) => setF('notes', e.target.value)} />
        </Field>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.isPrimary === true}
            onChange={(e) => setF('isPrimary', e.target.checked)}
          />
          <span>Birincil muhatap (firmada tek kişi olabilir)</span>
        </label>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Kişiyi sil"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>İptal</Button>
            <Button variant="primary" onClick={confirmDelete}>Sil</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.fullName}</strong>{' '}
          firma kişilerinden kaldırılacak.
        </p>
      </Modal>
    </Card>
  );
};
