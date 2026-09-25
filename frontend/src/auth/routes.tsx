import type { RouteObject } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
];

export default routes;
