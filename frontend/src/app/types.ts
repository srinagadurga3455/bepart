// Application-wide backend contract types.
//
// These mirror the server's Prisma models and DTOs (server/prisma/schema.prisma
// and server/src/*/dto). They live here — next to the shared Axios client —
// because they are consumed by admin, organizer, participant and auth alike.
// Component prop types stay local to their components; only genuinely shared
// backend shapes belong in this file.

export type Role = 'ADMIN' | 'ORGANIZER' | 'STUDENT';

export interface UserItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: UserItem;
  accessToken: string;
}

export type OrganizerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OrganizerItem {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  upiId?: string | null;
  status: OrganizerStatus;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string | null;
  adminId?: string | null;
  user?: { id: string; name: string; email: string; role: Role } | null;
  _count?: { events?: number };
}

export interface OrganizerPayload {
  name: string;
  email: string;
  description?: string;
  phone?: string;
  upiId: string;
}

export type OrganizerUpdatePayload = Partial<OrganizerPayload>;

export type EventStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export type FormFieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'textarea'
  | 'dropdown'
  | 'radio'
  | 'checkbox';

export interface FormFieldDef {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  /** Optional help text shown under the question (ignored by validation). */
  description?: string;
}

/** Team member group: repeat the nested fields based on a "number of members" question. */
export interface MemberGroupDef {
  repeatFrom: string;
  fields: FormFieldDef[];
}

export interface FormSectionDef {
  id: string;
  title: string;
  /** Optional section note written by the organizer's form builder. */
  description?: string;
  fields: FormFieldDef[];
  memberGroup?: MemberGroupDef;
}

export interface FormPaymentConfig {
  amount?: number;
  upiId?: string;
}

/** Optional visual theme for a registration form. All fields optional and
 *  ignored by backend validation — purely presentational, fully
 *  backward-compatible with forms that omit it. */
export interface FormTheme {
  /** Cover/header image URL shown at the top of the participant form. */
  headerImageUrl?: string;
  /** 'light' | 'bepart' (brand tint) | 'dark'. Defaults to light. */
  theme?: 'light' | 'bepart' | 'dark';
  questionFont?: 'default' | 'serif' | 'mono';
  questionSize?: 'sm' | 'md' | 'lg';
  answerFont?: 'default' | 'serif' | 'mono';
  answerSize?: 'sm' | 'md' | 'lg';
}

/** Settings controlling collection behavior, access, and confirmation for a registration form. */
export interface FormSettings {
  /** Collect participant name (auto-prefilled, not a hidden system field toggle). */
  collectName?: boolean;
  /** Collect participant phone (auto-prefilled). */
  collectPhone?: boolean;
  /** Collect participant email address as an additional field. */
  collectEmail?: boolean;
  /** Require the participant to be logged in before they can register. */
  requireLogin?: boolean;
  /** Allow the same phone/user to submit more than once. */
  allowMultipleSubmissions?: boolean;
  /** Message shown to participants after a successful registration. */
  confirmationMessage?: string;
  /** Whether the registration form is accepting responses. */
  registrationOpen?: boolean;
  /** Message shown when registrations are closed. */
  closedMessage?: string;
  /** Enable a privacy/consent section at the bottom of the form. */
  showConsentSection?: boolean;
  /** Custom privacy policy / terms text shown in the consent section. */
  consentText?: string;
  /** Label for the required consent checkbox. */
  consentCheckboxLabel?: string;
}

/** Registration form blueprint stored on the event (never modified by participants). */
export interface FormStructure {
  title: string;
  description?: string;
  sections: FormSectionDef[];
  payment?: FormPaymentConfig;
  theme?: FormTheme;
  settings?: FormSettings;
}

/** A participant's answers keyed by field name. Checkbox answers are arrays. */
export type FormDataValue = string | string[];
export type FormDataRecord = Record<string, FormDataValue | undefined>;

export interface EventItem {
  id: string;
  eventName: string;
  description?: string | null;
  date: string;
  slots: number;
  closingTime: string;
  status: EventStatus;
  isActive?: boolean;
  formStructure?: FormStructure | null;
  posterSquareUrl?: string | null;
  posterRectangleUrl?: string | null;
  paymentRequired: boolean;
  createdAt: string;
  updatedAt: string;
  organizerId: string;
  organizer?: Pick<OrganizerItem, 'id' | 'name'> | null;
  hasCoupon?: boolean;
  _count?: { registrations?: number };
}

// Preferred event artwork: wide banner first, then square, then nothing.
export function eventPoster(event: Pick<EventItem, 'posterRectangleUrl' | 'posterSquareUrl'> | null | undefined): string | null {
  return event?.posterRectangleUrl || event?.posterSquareUrl || null;
}

export interface EventPayload {
  eventName: string;
  description?: string;
  date: string;
  slots: number;
  closingTime: string;
  formStructure?: FormStructure;
  paymentRequired?: boolean;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export type EventListResponse = EventItem[] | Paged<EventItem>;
export type OrganizerListResponse = OrganizerItem[] | Paged<OrganizerItem>;
export type RegistrationListResponse = RegistrationItem[] | Paged<RegistrationItem>;
export type WithdrawalListResponse = WithdrawalItem[] | Paged<WithdrawalItem>;

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface RegistrationItem {
  registrationId: string;
  phone: string;
  formData?: FormDataRecord | null;
  paymentStatus?: PaymentStatus;
  checkedInAt?: string | null;
  eventId: string;
  createdAt: string;
  updatedAt: string;
  event?: EventItem | null;
}

export interface RegistrationPayload {
  eventId: string;
  phone: string;
  formData: FormDataRecord;
  /** Coupon code applied at POST /payments/init (required when the PAID payment carries one). */
  couponCode?: string;
}

/** Flat registration-with-ticket shape from GET /registrations/by-phone. */
export interface PhoneTicketItem extends RegistrationItem {
  ticketUrl?: string;
}

/** Public ticket lookup returns the registration with its event plus a shareable URL. */
export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'CANCELLED';

/** Public ticket shape from GET /tickets/:ticketId (no payment internals). */
export interface TicketItem {
  ticket: {
    code: string;
    status: TicketStatus;
    checkedInAt?: string | null;
    ticketUrl: string;
    createdAt: string;
  };
  registration: {
    registrationId: string;
    formData?: FormDataRecord | null;
    participantName: string;
  };
  event: (Omit<EventItem, 'formStructure'> & { formStructure?: FormStructure | null }) | null;
  checkedIn: boolean;
}

export interface CheckInResult {
  registrationId: string;
  checkedInAt?: string | null;
  alreadyCheckedIn?: boolean;
  message?: string;
  phone?: string;
  formData?: FormDataRecord | null;
  event?: Pick<EventItem, 'id' | 'eventName' | 'date' | 'organizerId'> | null;
}

export type WithdrawalStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED';

export interface WithdrawalItem {
  id: string;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  transactionId?: string | null;
  proofUrl?: string | null;
  rejectionReason?: string | null;
  requestedAt: string;
  paidAt?: string | null;
  createdAt: string;
  eventId: string;
  organizerId: string;
  organizer?: OrganizerItem | null;
  event?: EventItem | null;
}

export interface WithdrawalPayload {
  eventId: string;
  amount: number;
}

export interface PaymentItem {
  id: string;
  registrationId?: string | null;
  eventId?: string | null;
  phone?: string | null;
  amount: number;
  originalAmount?: number | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  event?: EventItem | null;
  registration?: RegistrationItem | null;
}

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';

export interface CouponItem {
  id: string;
  code: string;
  eventId: string;
  discountType: CouponDiscountType;
  discountValue: number;
  isActive: boolean;
  isUsed?: boolean;
  usedCount?: number;
  usageLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponPayload {
  discountType: CouponDiscountType;
  discountValue: number;
  isActive?: boolean;
  usageLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export interface ConfirmPaidPayload {
  transactionId: string;
  screenshot: File;
}

export interface AdminDashboardData {
  users: number;
  events: number;
  registrations: number;
}

export interface AdminPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  companyName: string;
  description?: string;
}

export interface EventQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ─── Admin organizer overview ──────────────────────────────────────────────────
// Returned by GET /organizers/:id/overview (ADMIN only).

export interface OrganizerOverviewEvent {
  id: string;
  eventName: string;
  date: string;
  status: EventStatus;
  isActive: boolean;
  paymentRequired: boolean;
  slots: number;
  registrationCount: number;
  /** Revenue in paise (Int). 0 for free events. Only PAID payments counted. */
  revenuePaise: number;
  /** True when the event's date has already passed. */
  isCompleted: boolean;
}

export interface OrganizerOverview {
  organizer: OrganizerItem;
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  totalRegistrations: number;
  /** Total revenue across all events in paise. */
  totalRevenuePaise: number;
  events: OrganizerOverviewEvent[];
}
