import RequireRole from '../../shared/components/RequireRole';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminOrganizersPage from './pages/AdminOrganizersPage.jsx';
import AdminOrganizerDetailPage from './pages/AdminOrganizerDetailPage.jsx';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage.jsx';
import AdminWithdrawalDetailPage from './pages/AdminWithdrawalDetailPage.jsx';
import AdminAccountPage from './pages/AdminAccountPage.jsx';

export const adminNav = [
  { label: 'Dashboard', to: '/admin', end: true },
  { label: 'Organizers', to: '/admin/organizers' },
  { label: 'Withdrawals', to: '/admin/withdrawals' },
  { label: 'Account', to: '/admin/account' },
];

const admin = (element) => <RequireRole roles={['ADMIN']}>{element}</RequireRole>;

const routes = [
  { path: '/admin', element: admin(<AdminDashboardPage />) },
  { path: '/admin/dashboard', element: admin(<AdminDashboardPage />) },
  { path: '/admin/organizers', element: admin(<AdminOrganizersPage />) },
  { path: '/admin/organizers/:id', element: admin(<AdminOrganizerDetailPage />) },
  { path: '/admin/withdrawals', element: admin(<AdminWithdrawalsPage />) },
  { path: '/admin/withdrawals/:id', element: admin(<AdminWithdrawalDetailPage />) },
  { path: '/admin/account', element: admin(<AdminAccountPage />) },
];

export default routes;
