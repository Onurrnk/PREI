import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { AddProject } from './AddProject';
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
      <MemoryRouter initialEntries={['/projects/new']}>
        <AddProject />
      </MemoryRouter>
    </ToastProvider>,
  );

describe('AddProject — gerçek POST /projects', () => {
  it('proje adı + geliştirici girilip 4 adım tamamlanınca gerçek projectsApi.create çağrılır', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('e.g. Beachfront Residences'), {
      target: { value: 'Palm Vista Towers' },
    });

    const devSelect = screen.getByRole('combobox', { name: 'Developer' });
    fireEvent.click(devSelect);
    fireEvent.click(await screen.findByRole('option', { name: /Emaar Properties/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));

    fireEvent.click(screen.getByRole('button', { name: 'Complete & Save Project' }));

    expect(await screen.findByText('Project Created Successfully')).toBeInTheDocument();
  });

  it('proje adı boşken kaydedilemez ve ilk adıma döner', async () => {
    renderPage();
    await screen.findByPlaceholderText('e.g. Beachfront Residences');

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(screen.getByText('Project name is required.')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('e.g. Beachfront Residences')).toBeInTheDocument();
  });
});
