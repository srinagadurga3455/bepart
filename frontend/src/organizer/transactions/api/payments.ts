import client from '../../../app/api/client';
import type { PaymentItem } from '../../../app/types';

export const paymentsApi = {
  mine: () => client.get<PaymentItem[]>('/payments/mine'),
  get: (id: string) => client.get<PaymentItem>(`/payments/${id}`),
  updateStatus: (id: string, status: 'PENDING' | 'PAID' | 'FAILED') =>
    client.patch<PaymentItem>(`/payments/${id}/status`, { status }),
};
