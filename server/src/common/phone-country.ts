// =====================================================================
// PREI | Telefon numarasından ülke çözümü.
//
// "Müşteri hangi ülkeden yazıyor" sorusunun cevabı numaranın alan
// kodunda duruyor ama hiçbir yerde okunmuyordu. Bu modül numarayı ülkeye
// çevirir; müşteri kartında "nereden yazıyor" olarak gösterilir ve
// "nereye yatırım yapmak istiyor" (investment_targets) ile YAN YANA durur
// — ikisi farklı şeydir, Türk müşteri Dubai isteyebilir.
//
// Uyarı: alan kodu ülkeyi KESİN göstermez (yurt dışında yaşayan Türk
// vatandaşı Türk hattı taşıyabilir). Bu yüzden sonuç "ipucu" olarak
// sunulur, kesin veri gibi değil.
// =====================================================================
import { countryByCode } from './geo';

/**
 * Alan kodu → ISO ülke. UZUN kodlar önce denenir: +1 ile +1242
 * (Bahamalar) çakışmasın diye sıralama uzunluğa göre yapılıyor.
 * Liste ProDuality'nin gerçekten karşılaştığı pazarlarla sınırlı;
 * dünyanın tamamını taşımak yanlış eşleşme riskini artırır.
 */
const DIAL_CODES: Array<{ code: string; country: string }> = [
  { code: '971', country: 'AE' },
  { code: '966', country: 'SA' },
  { code: '974', country: 'QA' },
  { code: '965', country: 'KW' },
  { code: '973', country: 'BH' },
  { code: '968', country: 'OM' },
  { code: '995', country: 'GE' },
  { code: '380', country: 'UA' },
  { code: '357', country: 'CY' },
  { code: '351', country: 'PT' },
  { code: '420', country: 'CZ' },
  { code: '353', country: 'IE' },
  { code: '212', country: 'MA' },
  { code: '994', country: 'AZ' },
  { code: '90',  country: 'TR' },
  { code: '44',  country: 'GB' },
  { code: '34',  country: 'ES' },
  { code: '49',  country: 'DE' },
  { code: '31',  country: 'NL' },
  { code: '30',  country: 'GR' },
  { code: '39',  country: 'IT' },
  { code: '33',  country: 'FR' },
  { code: '32',  country: 'BE' },
  { code: '41',  country: 'CH' },
  { code: '43',  country: 'AT' },
  { code: '46',  country: 'SE' },
  { code: '45',  country: 'DK' },
  { code: '47',  country: 'NO' },
  { code: '48',  country: 'PL' },
  { code: '7',   country: 'RU' },
  { code: '66',  country: 'TH' },
  { code: '65',  country: 'SG' },
  { code: '86',  country: 'CN' },
  { code: '91',  country: 'IN' },
  { code: '20',  country: 'EG' },
  { code: '1',   country: 'US' },
].sort((a, b) => b.code.length - a.code.length);

/** geo.ts'te olmayan ülkeler için yedek adlar (telefon listesi daha geniş). */
const EXTRA_NAMES: Record<string, string> = {
  KW: 'Kuveyt', BH: 'Bahreyn', OM: 'Umman', UA: 'Ukrayna', CZ: 'Çekya',
  IE: 'İrlanda', MA: 'Fas', AZ: 'Azerbaycan', BE: 'Belçika', CH: 'İsviçre',
  AT: 'Avusturya', SE: 'İsveç', DK: 'Danimarka', NO: 'Norveç', PL: 'Polonya',
  RU: 'Rusya', SG: 'Singapur', CN: 'Çin', IN: 'Hindistan', EG: 'Mısır',
};

export interface PhoneCountry {
  countryCode: string;
  countryName: string;
  /** Numaranın normalize hâli (+ ve rakamlar). */
  normalized: string;
}

/**
 * Numaradan ülkeyi çıkarır. Çözemezse null — TAHMİN ETMEZ.
 *
 * Ülkesiz/yerel format ("0532…") çözülmez: başında ülke kodu olmayan bir
 * numaradan ülke uydurmak yanlış bilgi üretir.
 */
export function countryFromPhone(phone: string | null | undefined): PhoneCountry | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;

  // Yalnız rakamlar; baştaki 00 uluslararası öneki + sayılır.
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) return null;

  const body = digits.slice(1);
  if (body.length < 7) return null;   // anlamlı bir numara değil

  for (const { code, country } of DIAL_CODES) {
    if (!body.startsWith(code)) continue;
    // Ülke kodundan sonra en az 6 hane kalmalı (yanlışlıkla kısa eşleşme olmasın).
    if (body.length - code.length < 6) continue;
    const name = countryByCode(country)?.tr ?? EXTRA_NAMES[country] ?? country;
    return { countryCode: country, countryName: name, normalized: `+${body}` };
  }
  return null;
}
