import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Placeholder translations. We will expand these as we build.
const resources = {
  en: {
    translation: {
      "app": {
        "title": "PREI | Smart Suites",
        "subtitle": "Enterprise Property & Investment Intelligence Platform"
      },
      "nav": {
        "dashboard": "Dashboard",
        "leads": "Leads",
        "clients": "Clients"
      }
    }
  },
  tr: {
    translation: {
      "app": {
        "title": "PREI | Smart Suites",
        "subtitle": "Kurumsal Emlak ve Yatırım Zekası Platformu"
      },
      "nav": {
        "dashboard": "Gösterge Paneli",
        "leads": "Adaylar",
        "clients": "Müşteriler"
      }
    }
  },
  nl: {
    translation: {
      "app": {
        "title": "PREI | Smart Suites",
        "subtitle": "Platform voor Enterprise Vastgoed- en Investeringsinformatie"
      },
      "nav": {
        "dashboard": "Dashboard",
        "leads": "Leads",
        "clients": "Klanten"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
