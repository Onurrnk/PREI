import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom scrollIntoView'i implemente etmez (SelectMenu gibi listbox bileşenleri
// açılışta çağırır) — no-op polyfill olmadan "not a function" ile patlar.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom window.matchMedia'yı implemente etmez (core/charts/theme.ts modül
// yüklenirken prefers-reduced-motion sorgular) — no-op polyfill olmadan
// "not a function" ile patlar.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
