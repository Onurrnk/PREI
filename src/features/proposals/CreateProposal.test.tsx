import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const renderPage = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/proposals/new']}>
        <CreateProposal />
      </MemoryRouter>
    </ToastProvider>,
  );

describe('CreateProposal — gerçek POST /proposals', () => {
  it('müşteri+proje seçilip 4 adım tamamlanınca gerçek proposalsApi.create çağrılır', async () => {
    renderPage();

    const clientSelect = await screen.findByRole('combobox', { name: 'Select Client' });
    fireEvent.click(clientSelect);
    fireEvent.click(await screen.findByRole('option', { name: /Oliver Hartwell/i }));

    const projectSelect = screen.getByRole('combobox', { name: 'Select Project' });
    fireEvent.click(projectSelect);
    fireEvent.click(await screen.findByRole('option', { name: /Beachfront Residences/i }));

    // Proje seçilince başlık otomatik dolduruldu (kullanıcı henüz yazmadıysa).
    expect(screen.getByDisplayValue(/Exclusive Investment Opportunity: Beachfront Residences/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));

    fireEvent.click(screen.getByRole('button', { name: 'Send Proposal to Client' }));

    expect(await screen.findByText('Proposal Saved')).toBeInTheDocument();
  });

  it('müşteri/proje seçilmeden Send butonu ilk adıma döner ve hata gösterir', async () => {
    renderPage();
    await screen.findByRole('combobox', { name: 'Select Client' });

    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Proposal to Client' }));

    await waitFor(() =>
      expect(screen.getByText('Please select a client, a project, and enter a title before sending.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox', { name: 'Select Client' })).toBeInTheDocument();
  });
});
