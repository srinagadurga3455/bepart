import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import RefundsPage from './pages/RefundsPage';
import ContactPage from './pages/ContactPage';
import TicketingPage from './pages/TicketingPage';

// Public trust/compliance pages. All render inside the landing chrome
// (Navbar/Footer) via the shared LegalLayout — no per-page shells.
//
// Canonical policy URLs are /privacy-policy and /refund-policy. The older
// short paths redirect so existing bookmarks keep working.
const routes: RouteObject[] = [
  { path: '/privacy-policy', element: <PrivacyPage /> },
  { path: '/privacy', element: <Navigate to="/privacy-policy" replace /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/refund-policy', element: <RefundsPage /> },
  { path: '/refunds', element: <Navigate to="/refund-policy" replace /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/ticketing', element: <TicketingPage /> },
];

export default routes;
