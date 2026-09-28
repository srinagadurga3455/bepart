import client from '../../../app/api/client';
import type { CouponItem, CouponPayload } from '../../../app/types';

export const couponsApi = {
  listForEvent: (eventId: string) => client.get<CouponItem[]>(`/events/${eventId}/coupons`),
  create: (eventId: string, data: CouponPayload & { code?: string }) =>
    client.post<CouponItem>(`/events/${eventId}/coupons`, { ...data, eventId }),
  update: (eventId: string, couponId: string, data: Partial<CouponPayload>) =>
    client.patch<CouponItem>(`/events/${eventId}/coupons/${couponId}`, data),
  remove: (eventId: string, couponId: string) =>
    client.delete<CouponItem>(`/events/${eventId}/coupons/${couponId}`),
};
