import client from '../../../app/api/client';
import type { ConfirmPaidPayload, WithdrawalItem, WithdrawalListResponse } from '../../../app/types';

export const withdrawalsApi = {
  list: () => client.get<WithdrawalListResponse>('/withdrawals'),
  get: (id: string) => client.get<WithdrawalItem>(`/withdrawals/${id}`),
  process: (id: string) => client.patch<WithdrawalItem>(`/withdrawals/${id}/process`),
  reject: (id: string) => client.patch<WithdrawalItem>(`/withdrawals/${id}/reject`),
  confirmPaid: (id: string, { transactionId, screenshot }: ConfirmPaidPayload) => {
    const form = new FormData();
    form.append('transactionId', transactionId);
    form.append('screenshot', screenshot);
    return client.post<WithdrawalItem>(`/withdrawals/${id}/confirm`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
