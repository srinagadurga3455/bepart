import client from '../../../app/api/client';
import type { PaymentItem } from '../../../app/types';

export interface PaymentPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalPaidPaise: number;
  pendingCount: number;
  failedCount: number;
}

export interface PaymentPage {
  data: PaymentItem[];
  meta: PaymentPageMeta;
}

// Admin transaction API — GET /payments/mine with ADMIN JWT returns ALL
// platform payments. Pass page/limit to get server-side paginated response.
export const adminPaymentsApi = {
  all: (params?: { page?: number; limit?: number }) =>
    client.get<PaymentItem[] | PaymentPage>('/payments/mine', { params }),
  get: (id: string) => client.get<PaymentItem>(`/payments/${id}`),
};
