// =====================================================================
// optimizeImage — geliştirici görselini katalog için küçültür/optimize eder.
// Gerçek sharp ile: büyük PNG → 2560px sığdır + JPEG; boyut küçülür, döner.
// =====================================================================
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from './intake.service';

async function bigPng(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 90, b: 150 } } })
    .png().toBuffer();
}

describe('optimizeImage', () => {
  it('büyük görseli 2560px içine sığdırır ve JPEG döndürür', async () => {
    const input = await bigPng(4000, 3000);
    const out = await optimizeImage(input);
    const m = await sharp(out).metadata();
    expect(m.format).toBe('jpeg');
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(2560);
    expect(m.width).toBe(2560);       // 4000→2560, oran korunur
    expect(m.height).toBe(1920);      // 3000 * 2560/4000
  });

  it('küçük görseli büyütmez (withoutEnlargement)', async () => {
    const input = await bigPng(800, 600);
    const m = await sharp(await optimizeImage(input)).metadata();
    expect(m.width).toBe(800);
    expect(m.height).toBe(600);
    expect(m.format).toBe('jpeg');
  });

  it('bozuk/görsel-olmayan girdi hata fırlatır (çağıran yakalar)', async () => {
    await expect(optimizeImage(Buffer.from('bu bir görsel değil'))).rejects.toThrow();
  });
});
