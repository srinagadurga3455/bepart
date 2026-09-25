import { BrowserRouter, useRoutes } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

import LandingPage from '../landing/pages/LandingPage';
import participantRoutes from '../participant/routes';
import authRoutes from '../auth/routes';
import organizerRoutes from '../organizer/routes';
import adminRoutes from '../admin/routes';

const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  ...participantRoutes,
  ...authRoutes,
  ...organizerRoutes,
  ...adminRoutes,
];

function AppRoutes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
