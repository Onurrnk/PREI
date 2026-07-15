import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { FinancialsDashboard } from './FinancialsDashboard';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('FinancialsDashboard — Export Report', () => {
  it('gerçek veri yüklenince Export Report bir CSV indirmesi tetikler', async () => {
    render(<FinancialsDashboard />);

    // Export butonu veri yüklenene kadar (!data) disabled kalır.
    const exportBtn = await screen.findByRole('button', { name: /export report/i });
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(exportBtn);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('Filters butonu artık gösterilmiyor (yalnız timeframe seçici var)', async () => {
    render(<FinancialsDashboard />);
    await screen.findByRole('button', { name: /export report/i });
    expect(screen.queryByRole('button', { name: /^filters$/i })).not.toBeInTheDocument();
  });
});
