import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import RequireRole from '../auth/components/RequireRole';
import DashboardPage from './dashboard/pages/DashboardPage';
import OrganizerEventsPage from './events/pages/OrganizerEventsPage';
import OrganizerEventDetailPage from './events/pages/OrganizerEventDetailPage';
import OrganizerWithdrawalsPage from './withdrawals/pages/OrganizerWithdrawalsPage';
import OrganizerAccountPage from './account/pages/OrganizerAccountPage';
import { EventCreatePage, EventEditPage } from './events/pages/EventWizard';

const org = (element: ReactNode) => <RequireRole roles={['ORGANIZER']}>{element}</RequireRole>;

const routes: RouteObject[] = [
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
