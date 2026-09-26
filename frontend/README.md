# BePart Frontend

BePart frontend is a TypeScript + React single-page application for campus events. It provides a public landing and event discovery experience, a participant registration and ticket flow, and role-protected organizer and admin dashboards.

Entry point: `src/main.tsx`. Routing is centralized in `src/routes/index.tsx` using React Router with feature-owned route modules.

## Features

Verified against the implementation in `src/`:

### Landing / Public experience

- Landing page (`/`) composed of `Navbar`, `HeroSection`, `TicketRecovery`, `HowItWorks`, `WhyBePart`, and `Footer`.
- Hero call-to-action navigates to `/events`.
- Static ticket-recovery prompt for finding a registration by mobile number.
- Public event browsing and event details without login.

### Participant

- Published events list at `/events` with poster, date, slots, status, and free/paid indicator.
- Public event detail page at `/events/:id`.
- Multi-section dynamic registration flow at `/register/:eventId`:
  - Section-by-section form with progress indicator.
  - Dynamic field types: text, tel, email, textarea, dropdown, radio, checkbox.
  - Team/member-group support driven by a member-count field.
  - Review step before submission.
  - Paid-event notice/payment step; online payment is explicitly not enabled, participants are directed to pay the organizer.
  - Success state linking to the generated ticket.
- Ticket page at `/ticket/:ticketId`:
  - QR code encoding the backend-provided public `ticketUrl`.
  - Event date/time, registration details, and entry instructions.

### Organizer

Protected by `RequireRole` with role `ORGANIZER`:

- Dashboard (`/organizer`, `/organizer/dashboard`):
  - Total events, registrations, revenue, lifecycle breakdown.
  - 7-day registration trend and per-event distribution.
- Events (`/organizer/events`):
  - List owned events with registration counts and collected amounts.
  - Lifecycle actions: move `DRAFT` to `PREVIEW`, publish from `PREVIEW`, cancel.
  - Withdraw action when collected funds are available.
- Event wizard (`/organizer/events/create`, `/organizer/events/:id/edit`):
  - Step 1: event details, capacity, free/paid + fee, poster upload.
  - Step 2: visual registration form builder with sections, fields, and member groups.
  - Step 3: participant-flow preview and publish controls.
  - Published events cannot be edited from the wizard.
- Event detail (`/organizer/events/:id`):
  - Payments summary, withdrawal status, per-event registrations with expandable submitted answers.
- Withdrawals (`/organizer/withdrawals`):
  - Own withdrawal history, status chips, transaction ID and payment proof access for paid withdrawals.
- Account (`/organizer/account`):
  - Linked organizer profile including status, phone, UPI ID, and description.

### Admin

Protected by `RequireRole` with role `ADMIN`:

- Dashboard (`/admin`, `/admin/dashboard`):
  - Total organizers, active organizers, total events, plus organizer table.
- Organizers (`/admin/organizers`, `/admin/organizers/:id`):
  - List, create, update, delete, approve/activate, and deactivate organizers.
  - Organizer detail with event history and conducted/upcoming counts.
- Withdrawals (`/admin/withdrawals`, `/admin/withdrawals/:id`):
  - Review all withdrawal requests.
  - Mark processing, reject, or confirm paid with transaction ID plus payment screenshot upload.
  - View payment proof for paid withdrawals.
- Account (`/admin/account`):
  - Current admin profile from `/auth/me` and sign-out action.

### Authentication

- Single OTP login page reused for all roles.
- Routes: `/login`, `/organizer/login`, `/admin/login`.
- Two-step flow: identifier then 6-digit passcode.

## Tech Stack

From `frontend/package.json`:

- React `^19.3.0`
- React DOM `^19.3.0`
- TypeScript `^6.0.3`
- Vite `^8.3.0`
- React Router DOM `^7.18.4`
- TanStack React Query `^5.103.2`
- Axios `^1.20.0`
- Material UI `@mui/material ^9.4.0`
- Material UI icons `@mui/icons-material ^9.4.0`
- Emotion `@emotion/react`, `@emotion/styled`
- React Hook Form `^7.88.0`
- `@hookform/resolvers ^5.9.1`
- Zod `^4.6.5`
- Notistack `^3.0.2`
- `qrcode.react ^4.2.0`
- `date-fns ^4.4.0`

Verified usage in source:

- MUI components/theme in `src/main.tsx` and throughout pages.
- React Query `useQuery`/`useMutation` for all server data.
- Axios shared client in `src/app/api/client.ts`.
- React Hook Form in login and registration flows.
- Notistack `SnackbarProvider` in `src/main.tsx`.
- `qrcode.react` `QRCodeSVG` in the ticket page.

## Project Structure

```text
src/
├── admin/
├── app/
├── auth/
├── landing/
├── organizer/
├── participant/
├── routes/
├── index.css
├── main.tsx
└── vite-env.d.ts
```

What each folder actually contains:

- `src/main.tsx`: app bootstrap, MUI theme, React Query client, snackbar provider, global CSS import.
- `src/routes/index.tsx`: root `BrowserRouter`, landing route, feature route spreads, `*` redirect to `/`.
- `src/app/`: shared frontend infrastructure:
  - `api/client.ts`: Axios instance, auth interceptors, `unwrapList`, `apiErrorMessage`.
  - `types.ts`: shared backend contract types for users, organizers, events, forms, registrations, withdrawals.
  - `components/`: shared UI such as dashboard shell, withdrawal status chip, proof viewer.
  - `utils/format.ts`: date and INR formatting helpers.
- `src/auth/`: OTP login implementation:
  - `api/auth.ts`
  - `components/RequireRole.tsx` including `useAuth` and `logout`.
  - `pages/LoginPage.tsx`
  - `routes.tsx`
- `src/landing/`: public landing page:
  - `pages/LandingPage.tsx`
  - `components/Navbar.tsx`, `HeroSection.tsx`, `TicketRecovery.tsx`, `HowItWorks.tsx`, `WhyBePart.tsx`, `Footer.tsx`.
- `src/participant/`: public participant experience:
  - `events/pages/EventsPage.tsx`, `EventDetailPage.tsx`, `events/api/events.ts`.
  - `registrations/pages/RegisterPage.tsx`, `registrations/api/registrations.ts`, registration flow components and member-group utils.
  - `tickets/pages/TicketPage.tsx`, `tickets/api/tickets.ts`.
  - `routes.tsx`.
- `src/organizer/`: organizer dashboard:
  - `dashboard/pages/DashboardPage.tsx`.
  - `events/pages/OrganizerEventsPage.tsx`, `OrganizerEventDetailPage.tsx`, `EventWizard.tsx`, event/registration APIs, form-builder components and utils.
  - `withdrawals/pages/OrganizerWithdrawalsPage.tsx`, withdrawal API and dialog.
  - `account/pages/OrganizerAccountPage.tsx` and account API.
  - Shared shell, identity hook, styles, and `routes.tsx`.
- `src/admin/`: admin dashboard:
  - `dashboard/pages/AdminDashboardPage.tsx` and dashboard API.
  - `organizers/pages/`, `organizers/api/`, organizer table component.
  - `withdrawals/pages/`, `withdrawals/api/`.
  - `account/pages/AdminAccountPage.tsx`.
  - Shared shell and `routes.tsx` including `adminNav`.
- `src/index.css`: minimal global styles and a `fadeIn` animation.
- `src/vite-env.d.ts`: Vite client types.

## Application Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Public landing page | Public |
| `/events` | List published events | Public |
| `/events/:id` | Public event details | Public |
| `/register/:eventId` | Participant registration flow | Public |
| `/ticket/:ticketId` | Ticket lookup and QR display | Public |
| `/login` | OTP login for all roles | Public |
| `/organizer/login` | Alias reusing OTP login | Public |
| `/admin/login` | Alias reusing OTP login | Public |
| `/organizer` | Organizer dashboard | `ORGANIZER` |
| `/organizer/dashboard` | Organizer dashboard alias | `ORGANIZER` |
| `/organizer/events` | Organizer-owned events | `ORGANIZER` |
| `/organizer/events/create` | Create event wizard | `ORGANIZER` |
| `/organizer/events/:id/edit` | Edit draft/preview event | `ORGANIZER` |
| `/organizer/events/:id` | Organizer event detail and registrations | `ORGANIZER` |
| `/organizer/withdrawals` | Organizer withdrawal history | `ORGANIZER` |
| `/organizer/account` | Organizer profile | `ORGANIZER` |
| `/admin` | Admin dashboard | `ADMIN` |
| `/admin/dashboard` | Admin dashboard alias | `ADMIN` |
| `/admin/organizers` | Manage organizers | `ADMIN` |
| `/admin/organizers/:id` | Organizer detail and events | `ADMIN` |
| `/admin/withdrawals` | Review withdrawal requests | `ADMIN` |
| `/admin/withdrawals/:id` | Withdrawal detail and payment confirmation | `ADMIN` |
| `/admin/account` | Admin profile and sign-out | `ADMIN` |
| `*` | Redirect unknown URLs to `/` | Public |

Role protection is implemented with `RequireRole`. Unauthenticated users are redirected to `/login`; authenticated users with the wrong role are redirected to `/`.

## Authentication

Implementation in `src/auth/api/auth.ts`, `src/auth/pages/LoginPage.tsx`, and `src/auth/components/RequireRole.tsx`:

- OTP-only login flow:
  1. User enters email or phone number.
  2. Frontend calls `POST /auth/request-otp`.
  3. User enters the 6-digit passcode.
  4. Frontend calls `POST /auth/verify-otp`.
- Identifier handling:
  - Values containing `@` are sent as `{ email }`.
  - Other values are sent as `{ phone }`.
  - Organizers normally sign in with their registered phone number; admins use email.
- Successful verification stores `accessToken` in `localStorage`.
- Role-based redirect after login:
  - `ADMIN` to `/admin`
  - `ORGANIZER` to `/organizer`
  - Other roles to `/events`
- Session validation uses `GET /auth/me`.
- `RequireRole` wraps organizer and admin routes and preserves the attempted location for post-login redirect.
- `logout()` removes stored tokens and navigates to `/login`.
- No backend authentication internals are documented here beyond the endpoints actually called by the frontend.

## Participant

Source: `src/participant/`.

- Event discovery uses:
  - `GET /events/public`
  - `GET /events/public/:id`
  - `GET /events/public/:id/registration-form`
- Registration uses:
  - `POST /registrations`
  - `GET /registrations/:id`
  - `POST /registrations/:id/cancel`
- Ticket lookup uses:
  - `GET /registrations/ticket/:id`
- Registration form data is dynamic and defined by each event's `formStructure`.
- Paid events display the configured fee from `formStructure.payment.amount`; the frontend does not create an online payment transaction.
- Ticket QR encodes `ticketUrl` returned by the backend, falling back to the current origin plus `/ticket/:registrationId`.

## Organizer

Source: `src/organizer/`.

- Event management uses:
  - `POST /events`
  - `GET /events/my`
  - `GET /events/:id`
  - `PATCH /events/:id`
  - `POST /events/:id/preview`
  - `POST /events/:id/publish`
  - `POST /events/:id/cancel`
  - `POST /events/:id/poster` with multipart image upload
- Registration overview uses:
  - `GET /registrations`
- Withdrawals use:
  - `POST /withdrawals`
  - `GET /withdrawals/mine`
- Organizer identity uses:
  - `GET /organizers/me`
- Event lifecycle visible in the UI: `DRAFT`, `PREVIEW`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
- Poster uploads accept JPEG, PNG, or WebP.
- Withdrawals require collected event revenue and an organizer UPI ID.

## Admin

Source: `src/admin/`.

- Dashboard/admin APIs used:
  - `GET /admin/dashboard`
  - `GET /admin/users`
  - `GET /admin/events`
  - `POST /admin/admins`
- Organizer management APIs used:
  - `POST /organizers`
  - `GET /organizers`
  - `GET /organizers/:id`
  - `GET /organizers/:id/events`
  - `PATCH /organizers/:id`
  - `PATCH /organizers/:id/approve`
  - `PATCH /organizers/:id/deactivate`
  - `DELETE /organizers/:id`
- Withdrawal management APIs used:
  - `GET /withdrawals`
  - `GET /withdrawals/:id`
  - `PATCH /withdrawals/:id/process`
  - `PATCH /withdrawals/:id/reject`
  - `POST /withdrawals/:id/confirm` with multipart `transactionId` and `screenshot`
- The admin UI performs manual payout confirmation: transfer funds externally, then record transaction ID and screenshot in the frontend.

## API Integration

- All HTTP traffic goes through the shared Axios client in `src/app/api/client.ts`.
- Base URL:

```ts
import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
```

- Requests attach:

```text
Authorization: Bearer <accessToken>
```

  when `accessToken` exists in `localStorage`.
- On `401`, the client attempts one retry using `refreshToken` and `POST /auth/refresh`; on refresh failure it clears tokens and redirects to `/login`.
- Backend list responses may be either a bare array or `{ data, meta }`; `unwrapList()` normalizes both shapes.
- `apiErrorMessage()` prefers backend-provided `message` and otherwise uses a caller-supplied fallback.
- Poster and withdrawal-proof uploads use `multipart/form-data`.
- Only the endpoint paths listed in the Participant, Organizer, Admin, and Authentication sections are referenced by the frontend. No other endpoints are documented here.

## State Management and Data Fetching

Verified patterns:

- TanStack React Query:
  - Global `QueryClientProvider` in `src/main.tsx`.
  - `useQuery` for events, registrations, tickets, organizers, withdrawals, dashboard data, and session data.
  - `useMutation` for registration creation.
  - `useQueryClient().invalidateQueries()` after organizer/admin mutations.
- React Hook Form:
  - Login identifier/OTP forms.
  - Participant multi-section registration flow with `FormProvider`.
- Local React state for wizards, dialogs, pagination, loading, and error/info messages.
- Browser `localStorage` for `accessToken` and `refreshToken`.
- No Redux, Zustand, or other global store was found in the frontend source.

## Environment Variables

From `frontend/.env.example` and `src/app/api/client.ts`:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API base URL used by the Axios client |

Example:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

Use a placeholder appropriate for the environment. Do not copy secret values from `.env`.

If `VITE_API_BASE_URL` is missing during development, the frontend warns in the console and falls back to `http://localhost:3000/api`.

## Local Development

Exact commands:

```bash
cd C:\Users\jyoth\OneDrive\Desktop\bepart\frontend
npm install
npm run dev
```

Vite prints the local development URL, normally `http://localhost:5173`.

Create `frontend/.env` before starting if the backend is not at the default URL:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Available Scripts

From `frontend/package.json`:

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Start Vite development server |
| `npm run build` | `vite build` | Create production build in `dist/` |
| `npm run lint` | `eslint .` | Lint the project |
| `npm run preview` | `vite preview` | Preview the production build locally |

Only these four scripts exist.

## Production Build

```bash
cd C:\Users\jyoth\OneDrive\Desktop\bepart\frontend
npm run build
```

This runs Vite's production build and generates `dist/`. `dist/` is generated build output, not application source.

To preview the built output locally:

```bash
npm run preview
```

## Docker

Both `frontend/Dockerfile` and `frontend/nginx.conf` exist and were inspected.

Build behavior:

1. `node:20-slim` stage installs dependencies with `npm ci`.
2. Copies the frontend source.
3. Runs `npm run build`.
4. Final `nginx:alpine` stage copies `/app/dist` to `/usr/share/nginx/html`.
5. Copies `nginx.conf` to `/etc/nginx/conf.d/default.conf`.
6. Exposes port `80`.
7. Starts Nginx with `nginx -g "daemon off;"`.

Serving behavior from `nginx.conf`:

- Serves the Vite build from `/usr/share/nginx/html`.
- Uses `try_files $uri $uri/ /index.html;` so client-side React Router routes work on refresh/deep links.
- Proxies `/api/` to:

```text
http://backend:3000/api/
```

  with WebSocket upgrade headers and forwarded host/IP headers.

No additional Docker commands are documented here beyond what the Dockerfile and Nginx configuration actually define.

## Code Quality

Available validation:

- ESLint flat config in `eslint.config.js`:
  - Ignores `dist/`.
  - JavaScript rules plus TypeScript ESLint recommended rules.
  - React Hooks and React Refresh plugins.
- TypeScript strict mode in `tsconfig.json` with `jsx: react-jsx`.
- Production build validation through `npm run build`.
- There is no dedicated `typecheck`, `test`, or `format` script in `package.json`.

Run:

```bash
npm run lint
npm run build
```

## Development Notes

- Source language is TypeScript/TSX; do not treat this project as JavaScript/JSX.
- Feature folders own their APIs, pages, components, routes, and utils.
- Shared backend types live in `src/app/types.ts`.
- Shared request behavior lives in `src/app/api/client.ts`.
- Organizer and admin pages consistently use shell layouts, status chips, loading spinners, and backend error messages.
- MUI theme, fonts, favicon, title, and description are defined in `src/main.tsx` and `index.html`.
- Currency is formatted for India with `formatINR`; event dates use shared formatting helpers.
- The landing ticket-recovery UI is presentational in the inspected implementation.

## Important Notes

- Frontend-only README: backend behavior is mentioned only where needed to explain frontend integration.
- Authentication depends on backend OTP delivery; development OTP handling is described by the login UI.
- Online payment is not enabled in the participant flow; paid registrations require manual organizer payment handling.
- Organizer payouts are manual: the admin transfers funds externally and records proof in the admin UI.
- The frontend requires a reachable backend at `VITE_API_BASE_URL`; otherwise public and protected data requests will fail.
- Unknown frontend URLs redirect to `/` rather than showing a separate 404 page.
