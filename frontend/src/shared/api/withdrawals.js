import client from './client';

export const withdrawalsApi = {
  create: (data) => client.post('/withdrawals', data),
  mine: () => client.get('/withdrawals/mine'),
  list: () => client.get('/withdrawals'),
  get: (id) => client.get(`/withdrawals/${id}`),
  process: (id) => client.patch(`/withdrawals/${id}/process`),
  reject: (id) => client.patch(`/withdrawals/${id}/reject`),
  confirmPaid: (id, { transactionId, screenshot }) => {
    const form = new FormData();
    form.append('transactionId', transactionId);
    form.append('screenshot', screenshot);
    return client.post(`/withdrawals/${id}/confirm`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Authenticated proof download (releases an object URL; caller must revoke it).
  proofUrl: async (id) => {
    const res = await client.get(`/withdrawals/${id}/proof`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
  },
};
