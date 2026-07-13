# n8n workflows (kaynak referansı)

Bu dosyalar n8n'de (`https://n8n.produality.com`) çalışan workflow'ların **Code node** içeriklerinin kaynak kopyasıdır — n8n Public API ile programatik olarak oluşturulur/güncellenir, elle UI'dan düzenlenmez. Buradaki dosyalar tek doğruluk kaynağı DEĞİLDİR (n8n'in kendi DB'si öyledir), yalnızca inceleme/versiyon takibi için.

## lead-scoring-code-node.js
- Workflow: **"PREI Lead Scoring (RAG)"** (id `j2KXVZzkQ8lgf3Hh`), Schedule Trigger → tek Code node, 6 saatte bir.
- Akış: `GET /api/agent/leads` (skorlanmamış lead'ler) → her biri için communications + embedding + `POST /api/agent/knowledge/search` (RAG) → OpenAI chat completion → `POST /api/agent/lead-score`.

## telegram-bridge-code-node.js
- Workflow: **"Eylul Telegram Bridge (test)"** (id `6xRwvvH4IcYBxvQq`), Webhook (`/webhook/telegram-eylul`) → tek Code node.
- Onur'un WhatsApp/Meta onayı beklenirken Eylül'ün (AI danışman) konuşma akışını test etmek için geçici köprü — bot: `@produality_ai_bot`. WhatsApp canlı olunca aynı desen (ingest+RAG+reply) `channel='whatsapp'` ile kullanılacak.
- Akış: Telegram update → `POST /api/agent/whatsapp-event` (channel=telegram, ingest+dedup) → communications geçmişi → embedding → RAG search → Eylül system prompt + chat completion → Telegram `sendMessage` → `POST /api/agent/outbound-message` (outbound log).

## Ortak mimari kararlar
- **`fetch` YOK** — n8n 2.29.10 Code node'ları ayrı bir task-runner process'inde çalışır, global `fetch` yoktur (`this.helpers.httpRequest` kullanılır, `json: true` ile).
- Sırlar (OPENAI_API_KEY, AGENT_API_KEY, PREI_API_BASE, TELEGRAM_BOT_TOKEN) workflow JSON'ına gömülmez, n8n container'ının ortam değişkenlerinden `$env` ile okunur (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` şart).
- n8n Public API'de schedule/webhook tetiklemeli workflow'lar için "run now" ucu yok — doğrulama ya gerçek tetikleyiciyle (webhook POST) ya da geçici bir test-webhook node'u ekleyip sonra kaldırarak yapılır.
