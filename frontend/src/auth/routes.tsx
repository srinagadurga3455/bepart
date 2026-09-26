import type { RouteObject } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  // Aliases — prevents "No routes matched location /admin/login"
  // There is a single OTP login for all roles; these just reuse it.
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/organizer/login', element: <LoginPage /> },
];

export default routes;
