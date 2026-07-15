import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { DeveloperProfile } from './DeveloperProfile';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderProfile = (id = '1') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/developers/${id}`]}>
        <Routes>
          <Route path="/developers/:id" element={<DeveloperProfile />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

describe('DeveloperProfile — gerçek PATCH /developers/:id + Visit Website', () => {
  it('Edit Profile ile isim değiştirilip kaydedilince başlıkta güncellenir', async () => {
    renderProfile();
    await screen.findByRole('heading', { name: 'Emaar Properties' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    const nameInput = await screen.findByDisplayValue('Emaar Properties');
    fireEvent.change(nameInput, { target: { value: 'Emaar Properties Group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Emaar Properties Group' })).toBeInTheDocument(),
    );
  });

  it('Visit Website gerçek bir pencere açar', async () => {
    renderProfile('2');
    await screen.findByRole('heading', { name: 'DAMAC Properties' });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: /website/i }));

    expect(openSpy).toHaveBeenCalledWith('https://www.damacproperties.com', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });
});
