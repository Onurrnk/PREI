import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { EmailClient } from './EmailClient';
import { ToastProvider } from '../../../core/components/Toast/ToastProvider';
import { handlers } from '../../../mocks/handlers';
import '../../../core/i18n/config';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderEmailClient = () =>
  render(
    <ToastProvider>
      <EmailClient clientEmail="o.hartwell@hartwellestates.co.uk" clientName="Oliver Hartwell" />
    </ToastProvider>,
  );

describe('EmailClient', () => {
  it('thread listesini ve ilk thread mesajını gerçek gmailApi verisinden render eder', async () => {
    renderEmailClient();
    await screen.findByText(/Dubai Marina Off-plan Projects/i);
    expect(await screen.findByText(/EMAAR Beachfront/i)).toBeInTheDocument();
  });

  it('yanıt gönderince yeni mesaj thread içinde anında görünür ve kutu temizlenir', async () => {
    renderEmailClient();
    await screen.findByText(/Dubai Marina Off-plan Projects/i);

    const textarea = (await screen.findByPlaceholderText(/reply|yanıt/i)) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test yanıtı 123' } });
    expect(textarea.value).toBe('Test yanıtı 123');

    const sendBtn = screen.getByRole('button', { name: /send|gönder/i });
    fireEvent.click(sendBtn);

    await waitFor(() => expect(screen.getByText('Test yanıtı 123')).toBeInTheDocument());
    await waitFor(() => expect(textarea.value).toBe(''));
  });
});
