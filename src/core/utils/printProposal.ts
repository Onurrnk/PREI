// =====================================================================
// PREI | printProposal — tarayıcının yazdırma/PDF akışıyla teklif çıktısı.
// body'ye print-proposal sınıfı eklenir (index.css @media print kuralları
// yalnız [data-print-root] işaretli bölümü görünür kılar), window.print()
// çağrılır, yazdırma bitince sınıf temizlenir.
// =====================================================================
export function printProposal(): void {
  document.body.classList.add('print-proposal');
  const cleanup = () => {
    document.body.classList.remove('print-proposal');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // afterprint bazı tarayıcılarda (iptal senaryosu) gecikebilir — emniyet.
  setTimeout(cleanup, 2000);
}
