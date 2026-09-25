import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import RequireRole from '../auth/components/RequireRole';
import AdminDashboardPage from './dashboard/pages/AdminDashboardPage';
import AdminOrganizersPage from './organizers/pages/AdminOrganizersPage';
import AdminOrganizerDetailPage from './organizers/pages/AdminOrganizerDetailPage';
import AdminWithdrawalsPage from './withdrawals/pages/AdminWithdrawalsPage';
import AdminWithdrawalDetailPage from './withdrawals/pages/AdminWithdrawalDetailPage';
import AdminAccountPage from './account/pages/AdminAccountPage';

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export const adminNav: NavItem[] = [
  { label: 'Dashboard', to: '/admin', end: true },
  { label: 'Organizers', to: '/admin/organizers' },
  { label: 'Withdrawals', to: '/admin/withdrawals' },
  { label: 'Account', to: '/admin/account' },
];

const admin = (element: ReactNode) => <RequireRole roles={['ADMIN']}>{element}</RequireRole>;

const routes: RouteObject[] = [
  { path: '/admin', element: admin(<AdminDashboardPage />) },
  { path: '/admin/dashboard', element: admin(<AdminDashboardPage />) },
  { path: '/admin/organizers', element: admin(<AdminOrganizersPage />) },
  { path: '/admin/organizers/:id', element: admin(<AdminOrganizerDetailPage />) },
  { path: '/admin/withdrawals', element: admin(<AdminWithdrawalsPage />) },
  { path: '/admin/withdrawals/:id', element: admin(<AdminWithdrawalDetailPage />) },
  { path: '/admin/account', element: admin(<AdminAccountPage />) },
];

export default routes;
