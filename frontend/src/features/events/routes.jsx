import EventsPage from './pages/EventsPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';

const routes = [
  { path: '/events', element: <EventsPage /> },
  { path: '/events/:id', element: <EventDetailPage /> },
];

export default routes;