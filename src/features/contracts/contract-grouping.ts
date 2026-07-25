// =====================================================================
// PREI | Sözleşmelerin firmaya göre gruplanması.
//
// Sözleşmeler tek düz listede karışıyordu. Artık firma firma ayrılıyor;
// firması belirsiz olanlar gizlenmez, en sonda ayrı bir grupta durur.
// =====================================================================
import type { ContractDTO } from '../../core/types';

export const UNASSIGNED_COMPANY = '__unassigned__';
export const UNASSIGNED_LABEL = 'Firma atanmamış';

export interface ContractGroup {
  /** organizationId, yoksa firma adı (eski kayıtlar), yoksa sabit kova. */
  key: string;
  name: string;
  contracts: ContractDTO[];
  /** Yaklaşan/süresi dolan sayısı — grup başlığında uyarı için. */
  expiringCount: number;
}

/**
 * Firmaya göre gruplar.
 *
 * Anahtar önce organizationId; o yoksa firma adı kullanılır (isim üzerinden
 * de olsa aynı firmanın kayıtları birleşsin). İkisi de yoksa tek bir
 * "Firma atanmamış" kovası — kayıt kaybolmasın.
 */
export function groupContractsByCompany(contracts: ContractDTO[]): ContractGroup[] {
  const groups = new Map<string, ContractGroup>();

  for (const c of contracts) {
    const name = (c.developer ?? '').trim();
    const key = c.organizationId ?? (name || UNASSIGNED_COMPANY);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: key === UNASSIGNED_COMPANY ? UNASSIGNED_LABEL : (name || UNASSIGNED_LABEL),
        contracts: [],
        expiringCount: 0,
      };
      groups.set(key, g);
    }
    g.contracts.push(c);
    if (c.status === 'Expiring' || c.status === 'Expired') g.expiringCount++;
  }

  const list = [...groups.values()];
  const unassigned = list.filter((g) => g.key === UNASSIGNED_COMPANY);
  const named = list
    .filter((g) => g.key !== UNASSIGNED_COMPANY)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return [...named, ...unassigned];
}
