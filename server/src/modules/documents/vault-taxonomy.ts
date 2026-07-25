// =====================================================================
// PREI | Kasa taksonomisi — saf (yan etkisiz) parçalar.
//
// Kasa artık düz değil: Firma → Proje → Kategori. Amaç karışıklığı
// önlemek — hangi evrak hangi firmanın hangi projesine ait, tek bakışta
// belli olsun. Firmaya ait ama projesiz evrak "Genel" altında toplanır.
// =====================================================================

/** Kanonik kategori kodları (DB check constraint ile birebir). */
export const CATEGORIES = [
  { code: 'contract',  label: 'Sözleşme' },
  { code: 'permit',    label: 'Ruhsat & İzin' },
  { code: 'legal',     label: 'Tapu & Hukuk' },
  { code: 'technical', label: 'Teknik & Plan' },
  { code: 'marketing', label: 'Broşür & Görsel' },
  { code: 'financial', label: 'Finansal' },
  { code: 'kyc',       label: 'KYC & Kimlik' },
  { code: 'other',     label: 'Diğer' },
] as const;

export type CategoryCode = (typeof CATEGORIES)[number]['code'];

export const CATEGORY_CODES: readonly string[] = CATEGORIES.map((c) => c.code);

/** Projesiz (firma geneli) evrakların sanal proje kimliği. */
export const GENERAL_BUCKET = '__general__';
export const GENERAL_LABEL = 'Genel (projeye bağlı değil)';
/** Firması belirsiz evraklar — eski kayıtlar buraya düşer. */
export const UNASSIGNED_BUCKET = '__unassigned__';
export const UNASSIGNED_LABEL = 'Firma atanmamış';

/**
 * Serbest metni kanonik kategoriye çevirir.
 *
 * Eski klasör adları (Contracts, Client KYC…) hâlâ gelebiliyor: 003e
 * öncesinden kalan istemciler ve intake gibi kod yolları. Tanınmayan her
 * şey 'other' olur — asla hata fırlatmaz, evrak kaybolmaz.
 */
export function normalizeCategory(input: string | null | undefined): CategoryCode {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return 'other';
  if ((CATEGORY_CODES as string[]).includes(raw)) return raw as CategoryCode;

  // Eski İngilizce klasör adları → yeni kategoriler.
  const legacy: Record<string, CategoryCode> = {
    'root': 'other',
    'contracts': 'contract',
    'client kyc': 'kyc',
    'marketing': 'marketing',
    'developer agreements': 'contract',
  };
  return legacy[raw] ?? 'other';
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? 'Diğer';
}

export interface VaultDocLike {
  id: string;
  name: string;
  folder: string;
  organizationId: string | null;
  organizationName: string | null;
  projectId: string | null;
  projectName: string | null;
  sizeMB: number;
}

export interface VaultCategoryNode {
  code: string;
  label: string;
  count: number;
}

export interface VaultProjectNode {
  id: string;          // proje id | GENERAL_BUCKET
  name: string;
  count: number;
  sizeMB: number;
  categories: VaultCategoryNode[];
}

export interface VaultCompanyNode {
  id: string;          // firma id | UNASSIGNED_BUCKET
  name: string;
  count: number;
  sizeMB: number;
  projects: VaultProjectNode[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Belgeleri Firma → Proje → Kategori ağacına çevirir.
 *
 * Sıralama kasıtlı: firmalar ve projeler ada göre (alfabetik, Türkçe
 * karşılaştırmayla), kategoriler ise TANIMLI SIRAYLA — kullanıcı her
 * firmada aynı düzeni görsün, dosya sayısına göre yer değiştirmesin.
 * "Genel" ve "Firma atanmamış" kovaları her zaman sona konur.
 */
export function buildVaultTree(docs: VaultDocLike[]): VaultCompanyNode[] {
  const companies = new Map<string, VaultCompanyNode>();

  for (const d of docs) {
    const companyId = d.organizationId ?? UNASSIGNED_BUCKET;
    const companyName = d.organizationId
      ? (d.organizationName ?? 'Adsız firma')
      : UNASSIGNED_LABEL;

    let company = companies.get(companyId);
    if (!company) {
      company = { id: companyId, name: companyName, count: 0, sizeMB: 0, projects: [] };
      companies.set(companyId, company);
    }
    company.count++;
    company.sizeMB += d.sizeMB;

    const projectId = d.projectId ?? GENERAL_BUCKET;
    const projectName = d.projectId ? (d.projectName ?? 'Adsız proje') : GENERAL_LABEL;

    let project = company.projects.find((p) => p.id === projectId);
    if (!project) {
      project = { id: projectId, name: projectName, count: 0, sizeMB: 0, categories: [] };
      company.projects.push(project);
    }
    project.count++;
    project.sizeMB += d.sizeMB;

    const code = normalizeCategory(d.folder);
    const cat = project.categories.find((c) => c.code === code);
    if (cat) cat.count++;
    else project.categories.push({ code, label: categoryLabel(code), count: 1 });
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'tr');
  const catOrder = (c: VaultCategoryNode) => CATEGORY_CODES.indexOf(c.code);

  const list = [...companies.values()];
  for (const c of list) {
    c.sizeMB = round2(c.sizeMB);
    // "Genel" kovası projelerin sonunda dursun.
    const general = c.projects.filter((p) => p.id === GENERAL_BUCKET);
    const named = c.projects.filter((p) => p.id !== GENERAL_BUCKET).sort(byName);
    c.projects = [...named, ...general];
    for (const p of c.projects) {
      p.sizeMB = round2(p.sizeMB);
      p.categories.sort((x, y) => catOrder(x) - catOrder(y));
    }
  }

  const unassigned = list.filter((c) => c.id === UNASSIGNED_BUCKET);
  const named = list.filter((c) => c.id !== UNASSIGNED_BUCKET).sort(byName);
  return [...named, ...unassigned];
}
