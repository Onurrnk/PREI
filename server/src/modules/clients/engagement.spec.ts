import { describe, it, expect } from 'vitest';
import {
  ENGAGEMENTS, readEngagement, applyEngagement, engagementLabel,
  type LeadState,
} from './engagement';

const lead = (over: Partial<LeadState> = {}): LeadState => ({
  status: 'contacted', priority: 'medium', ...over,
});

describe('readEngagement', () => {
  it('frozen durumu dondurulmuş okur', () => {
    expect(readEngagement(lead({ status: 'frozen' }))).toBe('frozen');
  });

  it('urgent/high öncelik sıcak sayılır', () => {
    expect(readEngagement(lead({ priority: 'urgent' }))).toBe('hot');
    expect(readEngagement(lead({ priority: 'high' }))).toBe('hot');
  });

  it('varsayılan normal', () => {
    expect(readEngagement(lead())).toBe('normal');
    expect(readEngagement(lead({ priority: 'low' }))).toBe('normal');
  });

  // Dondurulmuş + yüksek öncelik çelişkisinde donmuş hâli kazanır:
  // kullanıcı "peşine düşme" demiş, öncelik bunu ezmemeli.
  it('frozen, yüksek önceliği ezer', () => {
    expect(readEngagement(lead({ status: 'frozen', priority: 'urgent' }))).toBe('frozen');
  });

  it('lead yoksa normal', () => {
    expect(readEngagement(null)).toBe('normal');
    expect(readEngagement(undefined)).toBe('normal');
  });
});

describe('applyEngagement', () => {
  it('dondurma durumu frozen yapar', () => {
    expect(applyEngagement(lead(), 'frozen')).toEqual({ status: 'frozen' });
  });

  it('dondururken önceliğe dokunmaz (çözülünce geri gelsin)', () => {
    expect(applyEngagement(lead({ priority: 'urgent' }), 'frozen'))
      .not.toHaveProperty('priority');
  });

  // Aksi hâlde "sıcak" dediğiniz müşteri Kanban'da donmuş görünürdü.
  it('sıcak seçilince donmuş kayıt çözülür', () => {
    expect(applyEngagement(lead({ status: 'frozen' }), 'hot'))
      .toEqual({ status: 'contacted', priority: 'urgent' });
  });

  it('normal seçilince de çözülür', () => {
    expect(applyEngagement(lead({ status: 'frozen' }), 'normal'))
      .toEqual({ status: 'contacted', priority: 'medium' });
  });

  it('donmuş değilse yalnız öncelik değişir', () => {
    expect(applyEngagement(lead({ status: 'qualified' }), 'hot'))
      .toEqual({ priority: 'urgent' });
  });

  // Ticari sonucu bir arayüz düğmesi geri alamaz.
  it('kazanılmış/kaybedilmiş kaydın durumu değiştirilmez', () => {
    expect(applyEngagement(lead({ status: 'converted' }), 'frozen')).toEqual({});
    expect(applyEngagement(lead({ status: 'lost' }), 'frozen')).toEqual({});
  });

  it('kazanılmış kayıtta öncelik yine de değiştirilebilir', () => {
    expect(applyEngagement(lead({ status: 'converted' }), 'hot'))
      .toEqual({ priority: 'urgent' });
  });

  it('gidiş-dönüş tutarlı: uygula → oku aynı sonucu verir', () => {
    for (const e of ENGAGEMENTS) {
      const base = lead();
      const patch = applyEngagement(base, e);
      expect(readEngagement({ ...base, ...patch })).toBe(e);
    }
  });
});

describe('engagementLabel', () => {
  it('Türkçe ve İngilizce etiket', () => {
    expect(engagementLabel('frozen')).toBe('Dondurulmuş');
    expect(engagementLabel('hot', 'en')).toBe('Hot');
  });
});
