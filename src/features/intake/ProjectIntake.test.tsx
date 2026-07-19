// =====================================================================
// ProjectIntake — mükerrer proje işareti (onay kuyruğu rozeti + modal bandı).
// Queue handler override edilerek `duplicate` içeren bir gönderi döndürülür;
// satırda "Olası mükerrer" rozeti, incele modalında uyarı bandı beklenir.
// =====================================================================
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import i18n from 'i18next';
import { ProjectIntake } from './ProjectIntake';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);
beforeAll(async () => { server.listen({ onUnhandledRequest: 'bypass' }); await i18n.changeLanguage('tr'); });
afterEach(() => server.resetHandlers());
afterAll(async () => { server.close(); await i18n.changeLanguage('en'); });

const dupSubmission = {
  id: 'sub-dup-1', status: 'pending', title: 'Emaar Beachfront', developerName: 'Emaar',
  city: 'Dubai', district: 'Marina', marketCode: 'AE', priceMin: 500000, priceMax: 900000,
  currency: 'AED', commissionPct: 5, unitTypes: ['1+1', '2+1'], description: 'Deniz manzaralı.',
  latitude: 25.08, longitude: 55.14, mapUrl: null, imageUrls: [], imagesByCategory: {},
  downPaymentPct: 20, installmentMonths: 36, paymentNote: null, neighborhood: 'Marina',
  listingUrl: null, brochureUrl: null, createdPropertyId: null, reviewNote: null,
  duplicate: { refType: 'property', refId: 'p1', refTitle: 'Emaar Beachfront', matchedBy: 'aynı geliştirici' },
  createdAt: '2026-07-19T00:00:00.000Z',
};

const renderPage = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/projects/intake']}>
        <ProjectIntake />
      </MemoryRouter>
    </ToastProvider>,
  );

describe('ProjectIntake — mükerrer proje işareti', () => {
  it('duplicate gönderide kuyruk satırında "Olası mükerrer" rozeti gösterilir', async () => {
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([dupSubmission])));
    renderPage();
    await screen.findByText('Emaar Beachfront');
    expect(screen.getByText('Olası mükerrer')).toBeInTheDocument();
  });

  it('incele modalında mükerrer uyarı bandı eşleşen kaydı gösterir', async () => {
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([dupSubmission])));
    renderPage();
    fireEvent.click(await screen.findByText('Emaar Beachfront'));
    await waitFor(() =>
      expect(screen.getByText(/kataloğdaki "Emaar Beachfront" kaydıyla eşleşiyor/i)).toBeInTheDocument(),
    );
  });

  it('duplicate olmayan gönderide rozet gösterilmez', async () => {
    const clean = { ...dupSubmission, id: 'sub-2', duplicate: null };
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([clean])));
    renderPage();
    await screen.findByText('Emaar Beachfront');
    expect(screen.queryByText('Olası mükerrer')).not.toBeInTheDocument();
  });

  it('property eşleşmesinde incele modalı "Güncelle" + "Yeni ekle" butonlarını sunar', async () => {
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([dupSubmission])));
    renderPage();
    fireEvent.click(await screen.findByText('Emaar Beachfront'));
    await screen.findByRole('button', { name: /Mevcut projeyi güncelle/i });
    expect(screen.getByRole('button', { name: /Yeni olarak ekle/i })).toBeInTheDocument();
  });

  it('güncelle onayı update modunda çağrılır ve güncellendi mesajı çıkar', async () => {
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([dupSubmission])));
    let sentMode: string | null = null;
    server.use(http.post('/api/intake/queue/:id/approve', async ({ request }) => {
      const b = (await request.json()) as { mode?: string };
      sentMode = b.mode ?? null;
      return HttpResponse.json({ approved: true, propertyId: 'p1', updated: b.mode === 'update' });
    }));
    renderPage();
    fireEvent.click(await screen.findByText('Emaar Beachfront'));
    fireEvent.click(await screen.findByRole('button', { name: /Mevcut projeyi güncelle/i }));
    await waitFor(() => expect(sentMode).toBe('update'));
    await screen.findByText(/Mevcut proje güncellendi/i);
  });
});
