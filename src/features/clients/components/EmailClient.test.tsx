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

  it('yanıt gönderince yeni mesaj thread içinde anında görünür ve editör temizlenir', async () => {
    renderEmailClient();
    await screen.findByText(/Dubai Marina Off-plan Projects/i);

    // Zengin kompozör contentEditable div'dir (textarea değil).
    const editor = (await screen.findByRole('textbox', { name: /reply|yanıt/i })) as HTMLDivElement;
    editor.innerHTML = '<p>Test yanıtı 123</p>';
    fireEvent.input(editor);

    const sendBtn = screen.getByRole('button', { name: /send|gönder/i });
    await waitFor(() => expect(sendBtn).not.toBeDisabled());
    fireEvent.click(sendBtn);

    await waitFor(() => expect(screen.getByText('Test yanıtı 123')).toBeInTheDocument());
    await waitFor(() => expect(editor.innerHTML).toBe(''));
  });

  it('zengin biçimlendirme araç çubuğu ve şablon seçici render edilir', async () => {
    renderEmailClient();
    await screen.findByText(/Dubai Marina Off-plan Projects/i);

    // Kompozör, thread detayı yüklendikten sonra render olur — bekle.
    expect(await screen.findByRole('button', { name: /^bold$|^kalın$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^italic$|^italik$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /underline|altı çizili/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /template|şablon/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /attach|dosya ekle/i }).length).toBeGreaterThan(0);
  });
});
