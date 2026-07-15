import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { DevelopersList } from './DevelopersList';
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
      <MemoryRouter>
        <DevelopersList />
      </MemoryRouter>
    </ToastProvider>,
  );

describe('DevelopersList — gerçek POST /developers ve export', () => {
  it('Add Developer ile isim girilip gönderilince listeye eklenir', async () => {
    renderPage();
    await screen.findByText('Emaar Properties');

    fireEvent.click(screen.getByRole('button', { name: /add developer/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Emaar Properties'), {
      target: { value: 'Aldar Properties' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create developer/i }));

    expect(await screen.findByText('Aldar Properties')).toBeInTheDocument();
  });

  it('boş isimle gönderilemez', async () => {
    renderPage();
    await screen.findByText('Emaar Properties');

    fireEvent.click(screen.getByRole('button', { name: /add developer/i }));
    fireEvent.click(screen.getByRole('button', { name: /create developer/i }));

    await waitFor(() => expect(screen.getByText('Developer name is required.')).toBeInTheDocument());
  });

  it('Export gerçek bir CSV indirmesi tetikler', async () => {
    renderPage();
    await screen.findByText('Emaar Properties');

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
