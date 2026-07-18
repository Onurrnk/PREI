// =====================================================================
// sanitizeComposerHtml — giden maillerde XSS/whitelist güvenliği.
// Kompozörden gelen zengin gövde markalı şablona gömülmeden önce buradan
// geçer; bu testler tehlikeli içeriğin sızmadığını garanti eder.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { sanitizeComposerHtml } from './gmail.service';

describe('sanitizeComposerHtml', () => {
  it('script/style/iframe/object/embed bloklarını içerikle birlikte söker', () => {
    expect(sanitizeComposerHtml('<script>alert(1)</script>merhaba')).toBe('merhaba');
    expect(sanitizeComposerHtml('<style>body{}</style>x')).toBe('x');
    expect(sanitizeComposerHtml('<iframe src="evil"></iframe>y')).toBe('y');
    expect(sanitizeComposerHtml('<object data="x"></object>z')).toBe('z');
  });

  it('izin verilen biçim etiketlerini korur', () => {
    expect(sanitizeComposerHtml('<b>x</b>')).toBe('<b>x</b>');
    expect(sanitizeComposerHtml('<strong>x</strong>')).toBe('<strong>x</strong>');
    expect(sanitizeComposerHtml('<p>bir</p><p>iki</p>')).toBe('<p>bir</p><p>iki</p>');
    expect(sanitizeComposerHtml('<ul><li>a</li></ul>')).toBe('<ul><li>a</li></ul>');
    expect(sanitizeComposerHtml('<div><span>iç</span></div>')).toBe('<div><span>iç</span></div>');
  });

  it('izin verilmeyen etiketleri (metni koruyarak) söker', () => {
    // <img>/<svg> gibi etiketler kaldırılır; aradaki düz metin kalır.
    expect(sanitizeComposerHtml('<img src=x onerror="alert(1)">')).toBe('');
    expect(sanitizeComposerHtml('a<table>b</table>c')).toBe('abc');
    expect(sanitizeComposerHtml('<svg onload="alert(1)"></svg>ok')).toBe('ok');
  });

  it('<a> için yalnız http(s) href korur, diğer öznitelikleri atar', () => {
    expect(sanitizeComposerHtml('<a href="https://ex.com">link</a>'))
      .toBe('<a href="https://ex.com" style="color:#94529F;">link</a>');
    expect(sanitizeComposerHtml('<a href="http://ex.com">l</a>'))
      .toBe('<a href="http://ex.com" style="color:#94529F;">l</a>');
  });

  it('javascript: ve data: href\'lerini düşürür (a etiketi kalır ama href gitmez)', () => {
    expect(sanitizeComposerHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeComposerHtml('<a href="data:text/html,evil">x</a>')).toBe('<a>x</a>');
  });

  it('izin verilen etiketlerdeki event-handler özniteliklerini temizler', () => {
    expect(sanitizeComposerHtml('<p onclick="evil()">t</p>')).toBe('<p>t</p>');
    expect(sanitizeComposerHtml('<span style="x" onmouseover="a()">t</span>')).toBe('<span>t</span>');
  });

  it('düz metni değiştirmez', () => {
    expect(sanitizeComposerHtml('Merhaba, nasılsınız?')).toBe('Merhaba, nasılsınız?');
  });
});
