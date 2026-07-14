// =====================================================================
// PREI | i18n yapılandırması. Dil tercihi localStorage'da kalıcıdır
// (anahtar: prei.lang) — Settings > Preferences > System Language
// seçicisi i18n.changeLanguage() çağırır, seçim burada saklanır ve
// sonraki oturumda otomatik yüklenir. Kaynaklar: en.ts / tr.ts.
// =====================================================================
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { tr } from './tr';

const LANG_KEY = 'prei.lang';
export const SUPPORTED_LANGS = ['en', 'tr'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function savedLanguage(): SupportedLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v && (SUPPORTED_LANGS as readonly string[]).includes(v)) return v as SupportedLang;
  } catch {
    // localStorage erişilemedi (kısıtlı ortam) — varsayılana düş
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: { en, tr },
  lng: savedLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React zaten XSS'e karşı kaçışlıyor
  },
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANG_KEY, lng);
    document.documentElement.lang = lng;
  } catch {
    /* persist edilemedi — oturum içi çalışmaya devam */
  }
});

export default i18n;
