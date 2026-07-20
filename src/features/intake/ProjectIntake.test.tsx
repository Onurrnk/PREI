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
  checks: [],
  source: 'developer_submission',
  unitDetails: [],
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

  it('e-posta kaynaklı gönderide kuyrukta "E-posta taslağı" rozeti çıkar', async () => {
    const email = { ...dupSubmission, id: 'sub-email', duplicate: null, source: 'email_intake' };
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([email])));
    renderPage();
    await screen.findByText('Emaar Beachfront');
    expect(screen.getByText('E-posta taslağı')).toBeInTheDocument();
  });

  it('daire tipi/varyant galerileri incele modalında görünür', async () => {
    const withUnits = {
      ...dupSubmission, id: 'sub-units', duplicate: null,
      unitDetails: [{
        type: '2+1',
        variants: [{ label: 'A', images: ['https://x/a1.jpg', 'https://x/a2.jpg'], layout: 'https://x/layA.jpg' }],
      }],
    };
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([withUnits])));
    renderPage();
    fireEvent.click(await screen.findByText('Emaar Beachfront'));
    await screen.findByText('Daire Tipi Görselleri');
    expect(screen.getByText('2+1')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('property eşleşmesinde incele modalı "Güncelle" + "Yeni ekle" butonlarını sunar', async () => {
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([dupSubmission])));
    renderPage();
    fireEvent.click(await screen.findByText('Emaar Beachfront'));
    await screen.findByRole('button', { name: /Mevcut projeyi güncelle/i });
    expect(screen.getByRole('button', { name: /Yeni olarak ekle/i })).toBeInTheDocument();
  });

  it('ön-kontrol bayrakları kuyruk sayacında ve review modalında görünür', async () => {
    const flagged = {
      ...dupSubmission, id: 'sub-flag', duplicate: null,
      checks: [
        { code: 'no_commission', level: 'warn' as const },
        { code: 'few_images', level: 'info' as const },
      ],
    };
    server.use(http.get('/api/intake/queue', () => HttpResponse.json([flagged])));
    renderPage();
    await screen.findByText('Emaar Beachfront');
    fireEvent.click(screen.getByText('Emaar Beachfront'));
    await screen.findByText('Otomatik ön-kontrol');
    expect(screen.getByText('Komisyon oranı belirtilmemiş')).toBeInTheDocument();
    expect(screen.getByText('Az görsel (3’ten az)')).toBeInTheDocument();
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
