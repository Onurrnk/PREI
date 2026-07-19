import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { ProjectProfile } from './ProjectProfile';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderProjectProfile = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectProfile />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

describe('ProjectProfile — Send Email to Client composer', () => {
  it('müşteri seçilip gönderilince gerçek gmailApi.send çağrılır ve başarı mesajı gösterilir', async () => {
    renderProjectProfile();
    await screen.findByText('Beachfront Residences');

    const clientSelect = screen.getByRole('combobox', { name: /to \(client\)/i });
    fireEvent.click(clientSelect);
    const option = await screen.findByRole('option', { name: /Oliver Hartwell/i });
    fireEvent.click(option);

    const sendBtn = screen.getByRole('button', { name: /send email/i });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);

    expect(await screen.findByText(/Email sent to Oliver Hartwell/i)).toBeInTheDocument();
  });

  it('müşteri seçilmeden gönderilemez (buton disabled kalır)', async () => {
    renderProjectProfile();
    await screen.findByText('Beachfront Residences');

    const sendBtn = screen.getByRole('button', { name: /send email/i });
    expect(sendBtn).toBeDisabled();
  });

  it('yaşam döngüsü "Sold" seçilince setLifecycle çağrılır, mesaj + rozet çıkar', async () => {
    renderProjectProfile();
    await screen.findByText('Beachfront Residences');

    const lc = screen.getByRole('combobox', { name: /lifecycle/i });
    fireEvent.click(lc);
    fireEvent.click(await screen.findByRole('option', { name: /^Sold$/i }));

    expect(await screen.findByText('Project status updated.')).toBeInTheDocument();
    // Değişim sonrası refetch → rozet + combobox değeri "Sold" (en az 1 eşleşme)
    expect((await screen.findAllByText('Sold')).length).toBeGreaterThanOrEqual(1);
  });
});
