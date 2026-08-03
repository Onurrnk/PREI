import { describe, it, expect } from 'vitest';
import { isAnswerableChunk, META_CATEGORIES } from './knowledge-filter';

const c = (category?: string | null) => ({ metadata: category === undefined ? {} : { category } });

describe('isAnswerableChunk', () => {
  // Gerçek konuşmada Eylül'ü bozan belgeler tam olarak bunlardı.
  it('Eylül\'ün kendi senaryolarını eler', () => {
    expect(isAnswerableChunk(c('script'))).toBe(false);
    expect(isAnswerableChunk(c('sales_communication'))).toBe(false);
    expect(isAnswerableChunk(c('brand_voice'))).toBe(false);
    expect(isAnswerableChunk(c('policy'))).toBe(false);
    expect(isAnswerableChunk(c('automation'))).toBe(false);
  });

  it('piyasa ve müşteri bilgisini GEÇİRİR', () => {
    for (const k of ['market_intel', 'factsheet', 'faq', 'education', 'taxation']) {
      expect(isAnswerableChunk(c(k)), k).toBe(true);
    }
  });

  // Bunlar süreç anlatır ama MÜŞTERİYE anlatır — elenmemeli.
  it('müşteri süreci ve taksonomi rehberlerini elemez', () => {
    expect(isAnswerableChunk(c('process'))).toBe(true);
    expect(isAnswerableChunk(c('taxonomy'))).toBe(true);
  });

  it('kategorisi olmayan pasajı elemez (eski kayıtlar)', () => {
    expect(isAnswerableChunk(c())).toBe(true);
    expect(isAnswerableChunk({ metadata: null })).toBe(true);
    expect(isAnswerableChunk({})).toBe(true);
  });

  it('kategori string değilse elemez', () => {
    expect(isAnswerableChunk({ metadata: { category: 42 } })).toBe(true);
  });

  it('eleme listesi beklenen beş kategoriden ibaret', () => {
    expect([...META_CATEGORIES].sort()).toEqual(
      ['automation', 'brand_voice', 'policy', 'sales_communication', 'script'],
    );
  });
});
