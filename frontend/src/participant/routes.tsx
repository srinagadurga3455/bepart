import type { RouteObject } from 'react-router-dom';
import EventsPage from './events/pages/EventsPage';
import EventDetailPage from './events/pages/EventDetailPage';
import RegisterPage from './registrations/pages/RegisterPage';
import TicketPage from './tickets/pages/TicketPage';

const routes: RouteObject[] = [
  { path: '/events', element: <EventsPage /> },
  { path: '/events/:id', element: <EventDetailPage /> },
  { path: '/register/:eventId', element: <RegisterPage /> },
  { path: '/ticket/:ticketId', element: <TicketPage /> },
];

export default routes;
