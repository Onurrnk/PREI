import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { Settings } from './Settings';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { AuthProvider } from '../../core/auth/AuthContext';
import { ThemeProvider } from '../../core/theme/ThemeContext';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderSettings = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/settings']}>
        <AuthProvider>
          <ThemeProvider>
            <Settings />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    </ToastProvider>,
  );

const goToIntegrations = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Integrations' }));
};

// integrationName div (metni tutan) -> wrapper div -> integrationInfo div -> integrationCard div
const gmailCard = () => screen.getByText('Gmail Integration').parentElement!.parentElement!.parentElement!;

describe('Settings — Gmail entegrasyonu (Google OAuth)', () => {
  it('bağlı değilken Connect gösterir, Connect tıklanınca /auth/google/url çağrılır', async () => {
    renderSettings();
    await goToIntegrations();

    const card = gmailCard();
    const connectBtn = within(card).getByRole('button', { name: 'Connect' });

    // window.location.href atamasını jsdom'da güvenle gözlemlemek için mock'la.
    const originalHref = window.location.href;
    let assignedUrl: string | null = null;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { assignedUrl = v; }, get href() { return originalHref; } },
      writable: true,
    });

    fireEvent.click(connectBtn);

    await waitFor(() => expect(assignedUrl).toBe('/settings?gmail=connected'));
  });

  it('bağlıyken "Connected as ..." gösterir ve Disconnect ile bağlantıyı gerçekten keser', async () => {
    localStorage.setItem('prei_mock_gmail_connected', '1');
    renderSettings();
    await goToIntegrations();

    const card = gmailCard();
    expect(within(card).getByText(/Connected as sarah@prei\.app/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(within(card).queryByText(/Connected as/)).not.toBeInTheDocument());
    expect(within(card).getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });
});
