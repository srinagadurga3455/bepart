import { BrowserRouter, useRoutes } from 'react-router-dom';

import landingRoutes from './features/landing/routes.jsx';
import eventsRoutes from './features/events/routes.jsx';
import registrationsRoutes from './features/registrations/routes.jsx';
import authRoutes from './features/auth/routes.jsx';
import paymentsRoutes from './features/payments/routes.jsx';
import ticketsRoutes from './features/tickets/routes.jsx';
import organizerRoutes from './features/organizer/routes.jsx';
import adminRoutes from './features/admin/routes.jsx';
import checkinRoutes from './features/checkin/routes.jsx';

const routes = [
  ...landingRoutes,
  ...eventsRoutes,
  ...registrationsRoutes,
  ...authRoutes,
  ...paymentsRoutes,
  ...ticketsRoutes,
  ...organizerRoutes,
  ...adminRoutes,
  ...checkinRoutes,
];

function AppRoutes() {
  return useRoutes(routes);
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
