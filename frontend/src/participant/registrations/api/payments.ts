import client from '../../../app/api/client';

export interface PendingPayment {
  id: string;
  phone: string;
  eventId: string;
  amount: number;
  originalAmount?: number | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  status: string;
  couponId?: string | null;
  createdAt: string;
}

export interface InitPaymentPayload {
  eventId: string;
  phone: string;
  amount: number;
  couponCode?: string;
  formData?: Record<string, unknown>;
}

export const participantPaymentsApi = {
  init: (data: InitPaymentPayload) => client.post<PendingPayment>('/payments/init', data),
};
