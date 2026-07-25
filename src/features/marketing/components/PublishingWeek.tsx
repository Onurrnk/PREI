// =====================================================================
// PREI | PublishingWeek — haftalık yayın akışı.
//
// Onur'un tarifi: haftada 4 LinkedIn postu + 2-3 karusel, günlere
// dağıtılmış, marka diline uygun, PAYLAŞIMA HAZIR.
//
// Kritik: bu ekran hiçbir şey YAYINLAMAZ. LinkedIn'de otomasyon ban
// riski taşıdığı için metin Drive'da dosya olarak bekler; Onur kopyalar
// ve kendisi paylaşır. "Paylaştım" düğmesi yalnız bir kayıt.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { publishingApi, intelApi } from '../../../core/api/resources';
import type {
  PublishingPlanDTO, PublishingPlanItemDTO, IntelReportSummaryDTO, PlanImageDTO,
} from '../../../core/types';
import styles from './PublishingWeek.module.css';

const MARKET_LABEL: Record<string, string> = {
  TR: 'Türkiye', AE: 'BAE', ES: 'İspanya', GB: 'İngiltere',
  NL: 'Hollanda', DE: 'Almanya', TH: 'Tayland', GLOBAL: 'Global',
};

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });

/** Panoya kopyala — LinkedIn'e yapıştırılacak tam metin. */
function postText(item: PublishingPlanItemDTO): string {
  const tags = item.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ');
  return [item.hook, item.body, tags].filter(Boolean).join('\n\n');
}

export function PublishingWeek() {
  const toast = useToast();
  const [plans, setPlans] = useState<PublishingPlanDTO[]>([]);
  const [reports, setReports] = useState<IntelReportSummaryDTO[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, PlanImageDTO[]>>({});

  const load = useCallback(async () => {
    // Bağımsız istekler: rapor listesi düşerse plan yine görünsün.
    // (Promise.all kullanılırsa tek hata tüm paneli boşaltıyordu.)
    const [p, r] = await Promise.allSettled([publishingApi.list(8), intelApi.list()]);
    if (p.status === 'fulfilled') {
      setPlans(p.value);
      setOpenId((cur) => cur ?? p.value[0]?.id ?? null);
    } else {
      setPlans([]);
    }
    setReports(r.status === 'fulfilled' ? r.value : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const plan = plans.find((p) => p.id === openId) ?? null;
  const latestReport = reports[0] ?? null;

  const generate = async () => {
    if (!latestReport) return;
    setBusy('generate');
    try {
      const res = await publishingApi.generate(latestReport.id, { generateImages: false });
      if (!res.ok) { toast.error(res.message ?? 'Yayın akışı üretilemedi'); return; }
      toast.success('Haftalık yayın akışı hazır');
      if (res.drive && !res.drive.ok && res.drive.message) toast.error(res.drive.message);
      setOpenId(res.plan?.id ?? null);
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Yayın akışı üretilemedi');
    } finally {
      setBusy(null);
    }
  };

  const pushDrive = async () => {
    if (!plan) return;
    setBusy('drive');
    try {
      const res = await publishingApi.pushDrive(plan.id);
      if (res.ok) { toast.success('LinkedIn dosyaları Drive\'a yüklendi'); await load(); }
      else toast.error(res.message ?? 'Drive yüklemesi başarısız');
    } catch (e) {
      toast.error((e as Error).message || 'Drive yüklemesi başarısız');
    } finally {
      setBusy(null);
    }
  };

  const buildImages = async () => {
    if (!plan) return;
    setBusy('images');
    try {
      const res = await publishingApi.buildImages(plan.id);
      if (res.ok) toast.success(`${res.generated} karusel görseli üretildi`);
      else toast.error(res.message ?? 'Görseller üretilemedi');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Görseller üretilemedi');
    } finally {
      setBusy(null);
    }
  };

  const showImages = async (itemId: string) => {
    if (images[itemId]) { setImages((p) => { const n = { ...p }; delete n[itemId]; return n; }); return; }
    try {
      const fetched = await publishingApi.itemImages(itemId);
      setImages((p) => ({ ...p, [itemId]: fetched }));
    } catch {
      toast.error('Görseller alınamadı');
    }
  };

  const copy = async (item: PublishingPlanItemDTO, meta = false) => {
    const text = meta ? (item.instagramCaption ?? '') : postText(item);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Metin panoya kopyalandı');
    } catch {
      toast.error('Kopyalanamadı — metni elle seçin');
    }
  };

  const mark = async (item: PublishingPlanItemDTO, status: PublishingPlanItemDTO['status']) => {
    setBusy(item.id);
    try {
      await publishingApi.markItem(item.id, status);
      setPlans((prev) => prev.map((p) => (p.id !== plan?.id ? p : {
        ...p,
        items: p.items.map((i) => (i.id === item.id ? { ...i, status } : i)),
      })));
    } catch {
      toast.error('Güncellenemedi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card padding="md">
      <header className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>Haftalık Yayın Akışı</h2>
          <span className={styles.headMeta}>
            4 LinkedIn postu + 2-3 karusel · rapordan üretilir
          </span>
        </div>
        <div className={styles.headActions}>
          <Button
            size="sm" variant="secondary"
            disabled={busy !== null || !latestReport}
            onClick={generate}
          >
            {busy === 'generate' ? 'Hazırlanıyor…' : 'Son rapordan üret'}
          </Button>
        </div>
      </header>

      <p className={styles.note}>
        Sistem paylaşım YAPMAZ. Metinler burada ve Google Drive'da hazır bekler;
        LinkedIn ve Meta'da paylaşımı siz yaparsınız (otomasyon hesap riski taşır).
      </p>

      {plans.length === 0 && (
        <p className={styles.empty}>
          Henüz yayın akışı yok. Bir istihbarat raporu yükleyip "Son rapordan üret" deyin.
        </p>
      )}

      {plans.length > 1 && (
        <div className={styles.weekTabs}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === openId ? styles.weekTabActive : styles.weekTab}
              onClick={() => setOpenId(p.id)}
            >
              {fmtDay(p.weekStart)} – {fmtDay(p.weekEnd)}
            </button>
          ))}
        </div>
      )}

      {plan && (
        <>
          <div className={styles.planBar}>
            <span className={styles.planMeta}>
              {plan.items.filter((i) => i.kind === 'post').length} post ·{' '}
              {plan.items.filter((i) => i.kind === 'carousel').length} karusel
            </span>
            <div className={styles.planActions}>
              {plan.driveFolderLink ? (
                <a
                  className={styles.driveLink}
                  href={plan.driveFolderLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Drive klasörü
                </a>
              ) : null}
              <Button
                size="sm" variant="ghost" disabled={busy !== null}
                onClick={pushDrive}
              >
                {busy === 'drive' ? 'Yükleniyor…' : "Drive'a yükle"}
              </Button>
              <Button
                size="sm" variant="ghost" disabled={busy !== null}
                onClick={buildImages}
              >
                {busy === 'images' ? 'Üretiliyor…' : 'Karusel görselleri'}
              </Button>
            </div>
          </div>

          <ol className={styles.days}>
            {plan.items.map((item) => (
              <li key={item.id} className={styles.day}>
                <div className={styles.dayHead}>
                  <div className={styles.dayWhen}>
                    <strong className={styles.dayName}>{item.dayName}</strong>
                    <span className={styles.dayDate}>{fmtDay(item.scheduledDate)}</span>
                  </div>
                  <div className={styles.badges}>
                    <span className={item.kind === 'post' ? styles.badgePost : styles.badgeCarousel}>
                      {item.kind === 'post' ? 'Post' : `Karusel · ${item.slides.length} slayt`}
                    </span>
                    {item.marketCode && (
                      <span className={styles.badgeMarket}>
                        {MARKET_LABEL[item.marketCode] ?? item.marketCode}
                      </span>
                    )}
                    {item.status === 'published' && (
                      <span className={styles.badgeDone}>Paylaşıldı</span>
                    )}
                    {item.status === 'skipped' && (
                      <span className={styles.badgeSkip}>Atlandı</span>
                    )}
                  </div>
                </div>

                <h4 className={styles.itemTitle}>{item.title}</h4>

                {item.kind === 'post' ? (
                  <>
                    <p className={styles.hook}>{item.hook}</p>
                    <p className={styles.body}>{item.body}</p>
                  </>
                ) : (
                  <ol className={styles.slides}>
                    {item.slides.map((s) => (
                      <li key={s.index} className={styles.slide}>
                        <strong className={styles.slideHead}>{s.headline}</strong>
                        <span className={styles.slideBody}>{s.body}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {item.hashtags.length > 0 && (
                  <p className={styles.tags}>
                    {item.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                  </p>
                )}

                {images[item.id] && (
                  <div className={styles.imageStrip}>
                    {images[item.id].map((img) => (
                      <div key={img.slideIndex} className={styles.imageCell}>
                        {img.data ? (
                          <img
                            className={styles.image}
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`Slayt ${img.slideIndex}`}
                          />
                        ) : (
                          <span className={styles.imageError}>{img.error ?? 'Görsel yok'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.itemActions}>
                  {item.forLinkedin && (
                    <Button size="sm" variant="secondary" onClick={() => copy(item)}>
                      LinkedIn metnini kopyala
                    </Button>
                  )}
                  {item.instagramCaption && (
                    <Button size="sm" variant="ghost" onClick={() => copy(item, true)}>
                      Meta metnini kopyala
                    </Button>
                  )}
                  {item.driveFileLink && (
                    <a
                      className={styles.driveLink}
                      href={item.driveFileLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Drive dosyası
                    </a>
                  )}
                  {item.kind === 'carousel' && (
                    <Button size="sm" variant="ghost" onClick={() => void showImages(item.id)}>
                      {images[item.id]
                        ? 'Görselleri gizle'
                        : `Görseller${item.imageCount ? ` (${item.imageCount})` : ''}`}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === item.id}
                    onClick={() => mark(item, item.status === 'published' ? 'ready' : 'published')}
                  >
                    {item.status === 'published' ? 'Geri al' : 'Paylaştım'}
                  </Button>
                </div>
              </li>
            ))}
          </ol>

          {plan.skipped.length > 0 && (
            <section className={styles.skipped}>
              <h4 className={styles.skippedTitle}>Bu hafta kullanılmayanlar</h4>
              <ul className={styles.skippedList}>
                {plan.skipped.map((s) => (
                  <li key={s.topic} className={styles.skippedItem}>
                    <strong>{s.topic}</strong> — {s.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Card>
  );
}
