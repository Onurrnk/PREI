# TESTING — PREI

> %100 test kapsamı, hızlı ve güvenli AI-destekli geliştirmenin anahtarıdır. Testsiz vibe coding = yolo coding; testli = süper güç.

## Framework
- **Vitest 4** + **@testing-library/react** + jest-dom (jsdom ortamı)
- Config: `vitest.config.ts` · Setup: `src/test/setup.ts` (cleanup + localStorage temizliği)

## Çalıştırma
```bash
npm test          # tek koşu (CI bunu kullanır)
npm run test:watch  # izleme modu
```

## Katmanlar
| Katman | Ne test eder | Nerede |
|---|---|---|
| Unit | Saf mantık (permissions, api client, hook'lar) | `src/**/⟨dosya⟩.test.ts(x)` — kaynak dosyanın yanında |
| Component | Render + etkileşim (Testing Library) | aynı klasörde `.test.tsx` |
| Smoke/E2E | Kritik akışlar (login, RBAC deny, lead CRUD) | Faz 0'da Playwright ile eklenecek (B-11) |

## Konvansiyonlar
- Dosya adı: `⟨kaynak⟩.test.ts` / `.test.tsx`, kaynak dosyanın yanında.
- `describe` bloğu test edilen birimin adını taşır; test adları Türkçe davranış cümlesi.
- Anlamlı assertion: davranışı test et — `toBeDefined()` yasak.
- Her bug düzeltmesine regression testi; her yeni koşula (if/else) iki yol testi.
- Test dosyalarına asla gerçek secret/anahtar girmez.
