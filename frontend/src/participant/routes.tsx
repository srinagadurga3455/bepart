import type { RouteObject } from 'react-router-dom';
import EventsPage from './events/pages/EventsPage';
import EventDetailPage from './events/pages/EventDetailPage';
import RegisterPage from './registrations/pages/RegisterPage';
import TicketPage from './tickets/pages/TicketPage';
import UserDashboardPage from './dashboard/pages/UserDashboardPage';
import SupportPage from './support/pages/SupportPage';

const routes: RouteObject[] = [
  { path: '/events', element: <EventsPage /> },
  { path: '/events/:id', element: <EventDetailPage /> },
  { path: '/register/:eventId', element: <RegisterPage /> },
  { path: '/ticket/:ticketId', element: <TicketPage /> },
  { path: '/dashboard', element: <UserDashboardPage /> },
  { path: '/support', element: <SupportPage /> },
];

export default routes;
