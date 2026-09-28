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

/** Registration form blueprint stored on the event (never modified by participants). */
export interface FormStructure {
  title: string;
  description?: string;
  sections: FormSectionDef[];
  payment?: FormPaymentConfig;
  theme?: FormTheme;
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
}

/** Public ticket lookup returns the registration with its event plus a shareable URL. */
export interface TicketItem extends RegistrationItem {
  ticketUrl: string;
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
