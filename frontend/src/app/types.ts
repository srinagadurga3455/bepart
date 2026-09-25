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

/** Registration form blueprint stored on the event (never modified by participants). */
export interface FormStructure {
  title: string;
  description?: string;
  sections: FormSectionDef[];
  payment?: FormPaymentConfig;
}

/** A participant's answers keyed by field name. Checkbox answers are arrays. */
export type FormDataValue = string | string[];
export type FormDataRecord = Record<string, FormDataValue | undefined>;

export interface EventItem {
  id: number;
  eventName: string;
  description?: string | null;
  date: string;
  slots: number;
  closingTime: string;
  status: EventStatus;
  formStructure?: FormStructure | null;
  posterUrl?: string | null;
  paymentRequired: boolean;
  createdAt: string;
  updatedAt: string;
  organizerId: string;
  organizer?: Pick<OrganizerItem, 'id' | 'name'> | null;
  _count?: { registrations?: number };
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

export interface RegistrationItem {
  registrationId: string;
  phone: string;
  formData?: FormDataRecord | null;
  eventId: number;
  createdAt: string;
  updatedAt: string;
  event?: EventItem | null;
}

export interface RegistrationPayload {
  eventId: number;
  phone: string;
  formData: FormDataRecord;
}

/** Public ticket lookup returns the registration with its event plus a shareable URL. */
export interface TicketItem extends RegistrationItem {
  ticketUrl: string;
}

export type WithdrawalStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED';

export interface WithdrawalItem {
  id: string;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  transactionId?: string | null;
  proofUrl?: string | null;
  requestedAt: string;
  paidAt?: string | null;
  createdAt: string;
  eventId: number;
  organizerId: string;
  organizer?: OrganizerItem | null;
  event?: EventItem | null;
}

export interface WithdrawalPayload {
  eventId: number;
  amount: number;
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
