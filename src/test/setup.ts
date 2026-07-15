import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom scrollIntoView'i implemente etmez (SelectMenu gibi listbox bileşenleri
// açılışta çağırır) — no-op polyfill olmadan "not a function" ile patlar.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
