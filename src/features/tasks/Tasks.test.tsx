import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { Tasks } from './Tasks';
import { ToastProvider } from '../../core/components/Toast/ToastProvider';
import { handlers } from '../../mocks/handlers';
import '../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderTasks = () =>
  render(
    <ToastProvider>
      <Tasks />
    </ToastProvider>,
  );

describe('Tasks — görev oluşturma', () => {
  it('New Task ile başlıksız gönderim engellenir, geçerli veriyle görev Pending kolonuna eklenir', async () => {
    renderTasks();
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    await screen.findByPlaceholderText('e.g. Follow up with client');

    fireEvent.click(screen.getByRole('button', { name: /create task/i }));
    expect(await screen.findByText('Title is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. Follow up with client'), {
      target: { value: 'Test görevi' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => expect(screen.queryByPlaceholderText('e.g. Follow up with client')).not.toBeInTheDocument());
    expect(await screen.findByText('Test görevi')).toBeInTheDocument();
  });
});
