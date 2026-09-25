import client from '../../../app/api/client';
import type {
  WithdrawalItem,
  WithdrawalListResponse,
  WithdrawalPayload,
} from '../../../app/types';

export const withdrawalsApi = {
  create: (data: WithdrawalPayload) => client.post<WithdrawalItem>('/withdrawals', data),
  mine: () => client.get<WithdrawalListResponse>('/withdrawals/mine'),
};
