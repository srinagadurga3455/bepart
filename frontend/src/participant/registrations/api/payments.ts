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
  razorpayOrderId?: string | null;
  razorpayKeyId?: string | null;
  createdAt: string;
}

export interface InitPaymentPayload {
  eventId: string;
  phone: string;
  amount: number;
  couponCode?: string;
  formData?: Record<string, unknown>;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  paymentId: string;
  alreadyPaid?: boolean;
}

export const participantPaymentsApi = {
  init: (data: InitPaymentPayload) => client.post<PendingPayment>('/payments/init', data),
  verify: (data: VerifyPaymentPayload) => client.post<VerifyPaymentResult>('/payments/verify', data),
};
