import RequireRole from '../../shared/components/RequireRole';
import DashboardPage from './pages/DashboardPage.jsx';
import OrganizerEventsPage from './pages/OrganizerEventsPage.jsx';
import OrganizerEventDetailPage from './pages/OrganizerEventDetailPage.jsx';
import OrganizerWithdrawalsPage from './pages/OrganizerWithdrawalsPage.jsx';
import OrganizerAccountPage from './pages/OrganizerAccountPage.jsx';
import { EventCreatePage, EventEditPage } from './pages/EventWizard.jsx';

const org = (element) => <RequireRole roles={['ORGANIZER']}>{element}</RequireRole>;

const routes = [
  { path: '/organizer', element: org(<DashboardPage />) },
  { path: '/organizer/dashboard', element: org(<DashboardPage />) },
  { path: '/organizer/events', element: org(<OrganizerEventsPage />) },
  { path: '/organizer/events/create', element: org(<EventCreatePage />) },
  { path: '/organizer/events/:id/edit', element: org(<EventEditPage />) },
  { path: '/organizer/events/:id', element: org(<OrganizerEventDetailPage />) },
  { path: '/organizer/withdrawals', element: org(<OrganizerWithdrawalsPage />) },
  { path: '/organizer/account', element: org(<OrganizerAccountPage />) },
];

export default routes;
