// =====================================================================
// assembleUnitDetails — daire-tipi/varyant yapı meta'sını sıralı yüklenmiş
// URL'lerle eşler (imageCount sırayla tüketilir, hasLayout birer layout alır).
// =====================================================================
import { describe, it, expect } from 'vitest';
import { assembleUnitDetails } from './intake.service';

const imgs = (n: number) => Array.from({ length: n }, (_, i) => `img${i}`);

describe('assembleUnitDetails', () => {
  it('2+1 A/B: her varyanta imageCount kadar görsel + 1 layout eşler', () => {
    const meta = [{
      type: '2+1',
      variants: [
        { label: 'A', imageCount: 2, hasLayout: true },
        { label: 'B', imageCount: 3, hasLayout: true },
      ],
    }];
    const out = assembleUnitDetails(meta, ['a0', 'a1', 'b0', 'b1', 'b2'], ['layA', 'layB']);
    expect(out).toEqual([{
      type: '2+1',
      variants: [
        { label: 'A', images: ['a0', 'a1'], layout: 'layA' },
        { label: 'B', images: ['b0', 'b1', 'b2'], layout: 'layB' },
      ],
    }]);
  });

  it('hasLayout=false olan varyant layout almaz', () => {
    const meta = [{ type: '3+1', variants: [{ label: 'A', imageCount: 1, hasLayout: false }] }];
    const out = assembleUnitDetails(meta, ['x'], []);
    expect(out[0].variants[0].layout).toBeNull();
    expect(out[0].variants[0].images).toEqual(['x']);
  });

  it('çok tip: sıra korunur, görseller doğru dağıtılır', () => {
    const meta = [
      { type: '1+1', variants: [{ label: 'A', imageCount: 1, hasLayout: true }] },
      { type: '2+1', variants: [{ label: 'A', imageCount: 2, hasLayout: true }] },
    ];
    const out = assembleUnitDetails(meta, imgs(3), ['l0', 'l1']);
    expect(out[0].variants[0].images).toEqual(['img0']);
    expect(out[0].variants[0].layout).toBe('l0');
    expect(out[1].variants[0].images).toEqual(['img1', 'img2']);
    expect(out[1].variants[0].layout).toBe('l1');
  });

  it('eksik URL güvenli: taşmaz, var olanı atar', () => {
    const meta = [{ type: '2+1', variants: [{ label: 'A', imageCount: 5, hasLayout: true }] }];
    const out = assembleUnitDetails(meta, ['only1'], []); // 5 istendi, 1 var, layout yok
    expect(out[0].variants[0].images).toEqual(['only1']);
    expect(out[0].variants[0].layout).toBeNull();
  });

  it('boş meta → boş dizi', () => {
    expect(assembleUnitDetails([], ['a'], ['b'])).toEqual([]);
  });
});
