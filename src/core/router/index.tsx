import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '../../App';
import { Dashboard } from '../../features/dashboard/Dashboard';
import { LeadsPipeline } from '../../features/leads/LeadsPipeline';
import { ClientsList } from '../../features/clients/ClientsList';
import { ClientProfile } from '../../features/clients/ClientProfile';
import { DevelopersList } from '../../features/developers/DevelopersList';
import { DeveloperProfile } from '../../features/developers/DeveloperProfile';
import { ProjectsList } from '../../features/projects/ProjectsList';
import { ProjectProfile } from '../../features/projects/ProjectProfile';
import { AddProject } from '../../features/projects/AddProject';
import { ProposalsList } from '../../features/proposals/ProposalsList';
import { CreateProposal } from '../../features/proposals/CreateProposal';
import { ProposalView } from '../../features/proposals/ProposalView';
import { DocumentVault } from '../../features/documents/DocumentVault';
import { AuditLogs } from '../../features/admin/AuditLogs';
import { Settings } from '../../features/settings/Settings';
import { Meetings } from '../../features/meetings/Meetings';
import { FinancialsDashboard } from '../../features/financials/FinancialsDashboard';
import { ContractsList } from '../../features/contracts/ContractsList';
import { Marketing } from '../../features/marketing/Marketing';
import { Tasks } from '../../features/tasks/Tasks';
import { Login } from '../../features/auth/Login';
import { RequireAuth } from '../auth/RequireAuth';
const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'leads',
        element: <LeadsPipeline />,
      },
      {
        path: 'clients',
        element: <ClientsList />,
      },
      {
        path: 'clients/:id',
        element: <ClientProfile />,
      },
      {
        path: 'developers',
        element: <DevelopersList />,
      },
      {
        path: 'developers/:id',
        element: <DeveloperProfile />,
      },
      {
        path: 'projects',
        element: <ProjectsList />,
      },
      {
        path: 'projects/add',
        element: <AddProject />,
      },
      {
        path: 'projects/:id',
        element: <ProjectProfile />,
      },
      {
        path: 'proposals',
        element: <ProposalsList />,
      },
      {
        path: 'proposals/new',
        element: <CreateProposal />,
      },
      {
        path: 'proposals/:id',
        element: <ProposalView />,
      },
      {
        path: 'documents',
        element: <DocumentVault />,
      },
      {
        path: 'admin',
        element: (
          <RequireAuth permission="admin">
            <AuditLogs />
          </RequireAuth>
        ),
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'meetings',
        element: <Meetings />,
      },
      {
        path: 'financials',
        element: (
          <RequireAuth permission="financials">
            <FinancialsDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'contracts',
        element: (
          <RequireAuth permission="contracts">
            <ContractsList />
          </RequireAuth>
        ),
      },
      {
        path: 'marketing',
        element: (
          <RequireAuth permission="marketing">
            <Marketing />
          </RequireAuth>
        ),
      },
      {
        path: 'tasks',
        element: <Tasks />,
      },
      {
        path: '*',
        element: (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Coming Soon</h1>
            <p style={{ color: 'var(--text-secondary)' }}>This module is currently under development or has been disabled.</p>
          </div>
        ),
      },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
