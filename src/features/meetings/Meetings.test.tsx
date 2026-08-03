import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { Meetings } from './Meetings';
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
      <Meetings />
    </ToastProvider>,
  );

describe('Meetings — gerçek POST /meetings', () => {
  it('başlık/tarih/saat girilip Schedule Appointment ile gerçek randevu oluşturur', async () => {
    const { container } = renderPage();
    // Baslik HEM takvim hucresinde HEM "Yaklasan" listesinde gecer; findByText
    // "birden cok eleman" diye patliyordu. Varligini dogrulamak yeterli.
    // Sure de artirildi: yuklu makinede ilk cizim ~2 sn suruyor.
    await screen.findAllByText(/Viewing: Marina Vista/, {}, { timeout: 8000 });

    fireEvent.click(screen.getByRole('button', { name: /new appointment/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Property Viewing - Marina Vista'), {
      target: { value: 'Investor Call: Aldar Towers' },
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);
    const iso = futureDate.toISOString().slice(0, 10);
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: iso } });
    fireEvent.change(container.querySelector('input[type="time"]')!, { target: { value: '15:00' } });

    fireEvent.click(screen.getByRole('button', { name: /schedule appointment/i }));

    expect(await screen.findByText('Investor Call: Aldar Towers')).toBeInTheDocument();
  }, 20000);

  it('başlıksız gönderilemez', async () => {
    renderPage();
    // Baslik HEM takvim hucresinde HEM "Yaklasan" listesinde gecer; findByText
    // "birden cok eleman" diye patliyordu. Varligini dogrulamak yeterli.
    // Sure de artirildi: yuklu makinede ilk cizim ~2 sn suruyor.
    await screen.findAllByText(/Viewing: Marina Vista/, {}, { timeout: 8000 });

    fireEvent.click(screen.getByRole('button', { name: /new appointment/i }));
    fireEvent.click(screen.getByRole('button', { name: /schedule appointment/i }));

    await waitFor(() => expect(screen.getByText('Meeting title is required.')).toBeInTheDocument());
  }, 20000);
});
