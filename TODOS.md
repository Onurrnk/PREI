# TODOS — PREI

CEO review (2026-07-04) ertelemeleri. Format: What/Why/Context/Effort/Priority.

## 1. Demo/Lansman tenant'ı (E2)
- **What:** Anonimleştirilmiş gerçekçi demo tenant + 5 dakikalık senaryo turu (lead gelir → Eylül konuşur → pipeline → ROI ekranı).
- **Why:** 28 Ağustos lansmanında gerçek müşteri verisi ekranda olamaz (KVKK + itibar); demo tenant lansman gününün sigortası.
- **Context:** Multi-tenant mimari hazır; seed script yeterli. Lansman formatı (kapalı kapı mı, kamuya açık mı) netleşince karar verilecek.
- **Effort:** S (CC: ~20-30 dk) · **Priority:** P2 · **Depends:** Faz 1 (gerçek şema canlı olmalı)

## 2. Login güvenlik ekranı (son girişler + aktif oturumlar)
- **What:** Kullanıcı kendi hesabının son girişlerini/aktif oturumlarını görür, şüpheli oturumu sonlandırır.
- **Why:** G-6 verisini kullanıcıya açar — trust-building; Super Admin hesabına ekstra gözetim.
- **Context:** G-6 Telegram uyarıları zaten kurulacak; bu onun UI yüzü. Takım büyüyünce (A-2) değeri artar.
- **Effort:** M → CC: S · **Priority:** P3 · **Depends:** Faz 0 auth

## 3. PREI-içi WhatsApp inbox (OV-5'in evrimi)
- **What:** EmailClient benzeri konuşma ekranı: conversation_sessions görüntüle + Cloud API'den cevap gönder.
- **Why:** Lansman için Telegram köprüsü (Faz 2) yeterli; en iyi deneyim PREI içinde yazışmaktır.
- **Context:** Faz 2'de conversation_sessions + communications zaten dolacak; UI Faz 6/Komuta Merkezi dönemine aday.
- **Effort:** M → CC: S · **Priority:** P2 · **Depends:** Faz 2

## 4. Eylül canlı-veri eval genişletmesi
- **What:** Lansman sonrası gerçek konuşmalardan eval setine 20+ yeni vaka derle (Faz 2'deki sentetik seti besler).
- **Why:** Gerçek müşteri dili sentetik senaryolardan sapar; eval seti canlı veriyle güçlenir.
- **Context:** OV-2 kararıyla eval seti Faz 2'de kuruluyor; bu onun v2 beslemesi.
- **Effort:** S · **Priority:** P3 · **Depends:** Faz 2 + ~1 ay canlı veri
