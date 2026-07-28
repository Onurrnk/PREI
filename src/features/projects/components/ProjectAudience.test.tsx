import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ProjectAudience } from './ProjectAudience';
import { handlers } from '../../../mocks/handlers';
import '../../../core/i18n/config';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderAt = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/projects/:id" element={<>{ui}</>} />
        <Route path="/clients/:id" element={<div>MÜŞTERİ KARTI</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProjectAudience', () => {
  it('kimse yoksa boş durum gösterir', async () => {
    server.use(
      http.get('/api/projects/:id/audience', () =>
        HttpResponse.json({ total: 0, sold: 0, rejected: 0, people: [] })),
    );
    renderAt(<ProjectAudience projectId="p1" />);
    expect(await screen.findByText(/not presented to anyone yet|henüz kimseye sunulmadı/i))
      .toBeInTheDocument();
  });

  it('kişileri, sayımları ve aşama rozetini listeler', async () => {
    server.use(
      http.get('/api/projects/:id/audience', () =>
        HttpResponse.json({
          total: 2, sold: 1, rejected: 0,
          people: [
            {
              presentedId: 'x1', contactId: 'c1', name: 'Duygu Karataş', isCustomer: true,
              stage: 'sold', stageLabel: 'Satış tamamlandı', price: 520000, currency: 'EUR',
              presentedAt: '2026-07-01T00:00:00Z', dealId: 'd1',
            },
            {
              presentedId: 'x2', contactId: 'c2', name: 'Mert Aydın', isCustomer: false,
              stage: 'offer', stageLabel: 'Teklif verildi', price: null, currency: 'EUR',
              presentedAt: '2026-07-02T00:00:00Z', dealId: null,
            },
          ],
        })),
    );
    renderAt(<ProjectAudience projectId="p1" />);

    expect(await screen.findByText('Duygu Karataş')).toBeInTheDocument();
    expect(screen.getByText('Mert Aydın')).toBeInTheDocument();
    expect(screen.getByText('Satış tamamlandı')).toBeInTheDocument();
    // Fiyatı olmayan sunum tire ile gösterilir, 0 EUR diye yanıltmaz.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('520.000 EUR')).toBeInTheDocument();
  });

  // Asıl kazanç: projeden müşteriye tek tıkla geçebilmek.
  it('satıra tıklayınca müşteri kartına gider', async () => {
    server.use(
      http.get('/api/projects/:id/audience', () =>
        HttpResponse.json({
          total: 1, sold: 0, rejected: 0,
          people: [{
            presentedId: 'x1', contactId: 'c9', name: 'Duygu Karataş', isCustomer: true,
            stage: 'presented', stageLabel: 'Sunuldu', price: null, currency: 'EUR',
            presentedAt: '2026-07-01T00:00:00Z', dealId: null,
          }],
        })),
    );
    renderAt(<ProjectAudience projectId="p1" />);
    fireEvent.click(await screen.findByText('Duygu Karataş'));
    expect(await screen.findByText('MÜŞTERİ KARTI')).toBeInTheDocument();
  });
});
