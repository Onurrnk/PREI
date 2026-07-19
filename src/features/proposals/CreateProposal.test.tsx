import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { CreateProposal } from './CreateProposal';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderPage = (entry = '/proposals/new') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <CreateProposal />
      </MemoryRouter>
    </ToastProvider>,
  );

describe('CreateProposal — 5 adımlı gerçek akış', () => {
  it('müşteri+proje seçilip son adımda taslak kaydedilince gerçek proposalsApi.create çağrılır', async () => {
    renderPage();

    const clientSelect = await screen.findByRole('combobox', { name: 'Select Client' });
    fireEvent.click(clientSelect);
    fireEvent.click(await screen.findByRole('option', { name: /Oliver Hartwell/i }));

    const projectSelect = screen.getByRole('combobox', { name: 'Select Project' });
    fireEvent.click(projectSelect);
    fireEvent.click(await screen.findByRole('option', { name: /Beachfront Residences/i }));

    // Proje seçilince başlık otomatik dolduruldu.
    expect(screen.getByDisplayValue(/Exclusive Investment Opportunity: Beachfront Residences/)).toBeInTheDocument();

    // 5 adım: Hedef → Mülk → Finansal → Getiri → Önizleme (4 kez Next).
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    next(); next(); next(); next();

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(await screen.findByText('Draft Saved')).toBeInTheDocument();
  });

  it('müşteri/proje seçilmeden ilerleme engellenir (Next devre dışı)', async () => {
    renderPage();
    await screen.findByRole('combobox', { name: 'Select Client' });

    // Hiçbir seçim yokken bir sonraki adıma geçilemez.
    expect(screen.getByRole('button', { name: 'Next Step' })).toBeDisabled();
    // Başlıktaki "Send Proposal" (son adım + e-posta gerektirir) da devre dışı.
    expect(screen.getByRole('button', { name: /Send Proposal/i })).toBeDisabled();
  });
});
