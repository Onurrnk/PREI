// =====================================================================
// Eylül'ün cevap üretimi — dil tespiti, dolgu temizliği, prompt kurulumu.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { detectLang, stripFiller, toPlainText, buildPrompt } from './eylul-brain';

describe('detectLang', () => {
  it('Türkçe karakterden Türkçe anlar', () => {
    expect(detectLang('Dubai için bütçem 500 bin dolar')).toBe('tr');
  });
  it('Türkçe karakter olmasa da işlev sözcüğünden anlar', () => {
    expect(detectLang('merhaba fiyat nedir')).toBe('tr');
  });
  it('İngilizce mesajı İngilizce sayar', () => {
    expect(detectLang('Hello, what is the price for a property in Dubai?')).toBe('en');
  });
  it('belirsiz/boş mesajda ana pazara (tr) düşer', () => {
    expect(detectLang('')).toBe('tr');
    expect(detectLang('...')).toBe('tr');
    expect(detectLang('Dubai 2+1 250000')).toBe('tr');
  });
});

describe('stripFiller', () => {
  it('"Başka bir konuda yardımcı olabilir miyim?" kapanışını siler', () => {
    expect(stripFiller('Dubai için 3 seçenek var. Başka bir konuda yardımcı olabilir miyim?'))
      .toBe('Dubai için 3 seçenek var.');
  });
  it('"Yardımcı olmaktan memnuniyet duyarım" kapanışını siler', () => {
    expect(stripFiller('Not aldım. Yardımcı olmaktan memnuniyet duyarım.')).toBe('Not aldım.');
  });
  it('"Başka sorunuz olursa buradayım" kapanışını siler', () => {
    expect(stripFiller('Bilgiyi ilettim. Başka sorunuz olursa buradayım.')).toBe('Bilgiyi ilettim.');
  });
  it('İngilizce dolgu kapanışını siler', () => {
    expect(stripFiller('Here are three options. Is there anything else I can help with?'))
      .toBe('Here are three options.');
  });
  it('GERÇEK soruyla biten cevaba dokunmaz', () => {
    const t = 'Dubai bölgesinde birkaç seçenek var. Hangi şehri düşünüyorsunuz?';
    expect(stripFiller(t)).toBe(t);
  });
  it('cevabın tamamı dolguysa boş mesaj üretmez', () => {
    expect(stripFiller('Yardımcı olmaktan memnuniyet duyarım.')).not.toBe('');
  });
  it('null/undefined/boş girdide çökmez', () => {
    expect(stripFiller(null)).toBe('');
    expect(stripFiller(undefined)).toBe('');
    expect(stripFiller('   ')).toBe('');
  });
});

describe('toPlainText', () => {
  it('markdown vurguyu ve başlığı söker', () => {
    expect(toPlainText('## Başlık\n**kalın** ve *italik*')).toBe('Başlık\nkalın ve italik');
  });
  it('markdown linki düz URL yapar', () => {
    expect(toPlainText('[randevu](https://calendly.com/produality-info/30min)'))
      .toBe('randevu https://calendly.com/produality-info/30min');
  });
});

describe('buildPrompt', () => {
  const base = {
    persona: 'PERSONA_METNI',
    rules: 'Dil: {{replyLang}}. Bilgi: {{knowledgeText}}',
    knowledgeText: 'Türkiye 400.000 USD vatandaşlık.',
    replyLang: 'tr' as const,
    history: [],
    message: 'Merhaba',
  };

  it('placeholder\'ları doldurur', () => {
    const [, rules] = buildPrompt(base);
    expect(rules.content).toContain('Dil: Türkçe');
    expect(rules.content).toContain('Türkiye 400.000 USD vatandaşlık.');
    expect(rules.content).not.toContain('{{');
  });

  it('İngilizce cevap dilini kurallara yazar', () => {
    const [, rules] = buildPrompt({ ...base, replyLang: 'en' });
    expect(rules.content).toContain('Dil: İngilizce');
  });

  it('bilgi bankası boşsa uydurmasın diye açıkça belirtir', () => {
    const [, rules] = buildPrompt({ ...base, knowledgeText: '   ' });
    expect(rules.content).toContain('(ilgili kayıt bulunamadı)');
  });

  it('geçmişi doğru rollerle sıralar, son mesajı en sona koyar', () => {
    const msgs = buildPrompt({
      ...base,
      history: [
        { direction: 'inbound', body: 'Selam' },
        { direction: 'outbound', body: 'Merhabalar, ben Eylül' },
      ],
      message: 'Dubai için bilgi alabilir miyim?',
    });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'system', 'user', 'assistant', 'user']);
    expect(msgs[msgs.length - 1].content).toBe('Dubai için bilgi alabilir miyim?');
  });

  it('bilinen adı persona bağlamına ekler; bilinmiyorsa bunu da söyler', () => {
    expect(buildPrompt({ ...base, contactName: 'Kudret Kalyoncu' })[0].content)
      .toContain('bilinen adı: Kudret Kalyoncu');
    expect(buildPrompt({ ...base, contactName: null })[0].content)
      .toContain('adını henüz bilmiyorsun');
  });
});
