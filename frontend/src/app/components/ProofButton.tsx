import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { withdrawalsApi } from '../api';

// Authenticated payment-proof viewer. The image is fetched with the user's
// JWT (never a public URL) and shown from a revocable object URL.
export default function ProofButton({ withdrawalId, label = 'View Payment Proof' }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const openProof = async () => {
    setError('');
    setLoading(true);
    try {
      const objectUrl = await withdrawalsApi.proofUrl(withdrawalId);
      setUrl(objectUrl);
      setOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load payment proof.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    if (url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      <Button size="small" variant="outlined" disabled={loading} onClick={openProof}>
        {loading ? 'Loading…' : label}
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Payment Proof</DialogTitle>
        <DialogContent>
          {url && (
            <Box component="img" src={url} alt="Payment proof"
              sx={{ width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={close}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
