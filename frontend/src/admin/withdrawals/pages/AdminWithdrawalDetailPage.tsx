import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip,
  Divider, TextField, Typography,
} from '@mui/material';
import {
  ArrowBack, CheckCircleOutlined, HourglassEmpty, ReceiptLongOutlined,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { withdrawalsApi } from '../api/withdrawals';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import { apiErrorMessage } from '../../../app/api/client';
import AdminShell from '../../components/AdminShell';
import ProofButton from '../../../app/components/ProofButton';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.1,
        borderBottom: `1px solid ${CARD_BORDER}`,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED, width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: INK, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, mb: 2.5 }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ color: BLUE }}>{icon}</Box>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function DetailContent({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // PROCESSING confirmation fields
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [txnError, setTxnError] = useState('');

  // Reject dialog
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['admin', 'withdrawal', id],
    queryFn: () => withdrawalsApi.get(id),
  });
  const w = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawal', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
  };

  const run = async (fn: () => Promise<unknown>, okMsg: string, failMsg: string) => {
    setActionError('');
    setBusy(true);
    try {
      await fn();
      refresh();
      enqueueSnackbar(okMsg, { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, failMsg);
      setActionError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = () => {
    setTxnError('');
    setActionError('');
    if (!transactionId.trim()) {
      setTxnError('Transaction ID is required before marking as paid.');
      return;
    }
    if (!screenshot) {
      setTxnError('Payment proof screenshot is required before marking as paid.');
      return;
    }
    run(
      () =>
        withdrawalsApi.confirmPaid(id, {
          transactionId: transactionId.trim(),
          screenshot,
        }),
      'Withdrawal marked as Paid.',
      'Could not confirm payment.',
    );
  };

  if (isLoading) return <LoadingState message="Loading withdrawal request..." />;
  if (loadError || !w) return <ErrorState message="Withdrawal request not found." />;

  const isRequested = w.status === 'REQUESTED';
  const isProcessing = w.status === 'PROCESSING';
  const isPaid = w.status === 'PAID';
  const isRejected = w.status === 'REJECTED';
  const isOpen = isRequested || isProcessing;

  return (
    <Box>
      {/* Back navigation */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 17 }} />}
          onClick={() => navigate('/admin/withdrawals')}
          sx={{
            color: BLUE,
            fontWeight: 600,
            fontSize: 14,
            textTransform: 'none',
            p: 0,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          Back to Withdrawal Requests
        </Button>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {/* ── Summary header card ──────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2.5 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: BLUE, fontSize: 20, fontWeight: 800 }}>
              {w.organizer?.name?.charAt(0)?.toUpperCase() || 'W'}
            </Avatar>
            <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: INK,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                }}
              >
                {formatINR(w.amount)}
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: MUTED, mt: 0.25 }}>
                {w.event?.eventName || `Event ${w.eventId}`}
                {' · '}
                Requested {formatEventDate(w.requestedAt)}
              </Typography>
            </Box>
            <WithdrawalStatusChip status={w.status} />
          </Box>
        </CardContent>
      </Card>

      {/* ── Section 1: Organizer ─────────────────────────────────────────── */}
      <SectionCard icon={<ReceiptLongOutlined sx={{ fontSize: 19 }} />} title="Organizer">
        <Box
          sx={{
            bgcolor: '#F6F8FB',
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 2,
            px: 2.5,
            py: 0.5,
          }}
        >
          <InfoRow label="Name" value={w.organizer?.name || '—'} />
          <InfoRow label="Email" value={w.organizer?.email || '—'} />
          <InfoRow label="Phone" value={w.organizer?.phone || '—'} />
          <InfoRow label="UPI ID" value={w.organizer?.upiId || '—'} />
        </Box>
      </SectionCard>

      {/* ── Section 2: Payout details ────────────────────────────────────── */}
      <SectionCard icon={<HourglassEmpty sx={{ fontSize: 19 }} />} title="Payout Details">
        <Box
          sx={{
            bgcolor: '#F6F8FB',
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 2,
            px: 2.5,
            py: 0.5,
          }}
        >
          <InfoRow label="Amount" value={formatINR(w.amount)} />
          <InfoRow label="UPI ID" value={w.upiId || '—'} />
          <InfoRow
            label="Event"
            value={
              w.event?.eventName
                ? `${w.event.eventName}${w.event.date ? '  ·  ' + formatEventDate(w.event.date) : ''}`
                : `Event ${w.eventId}`
            }
          />
          <InfoRow label="Requested On" value={formatEventDate(w.requestedAt)} />
          <InfoRow
            label="Status"
            value={
              isRequested
                ? 'Pending — awaiting admin action'
                : isProcessing
                ? 'Processing — payment in progress'
                : isPaid
                ? 'Paid'
                : isRejected
                ? `Rejected${w.rejectionReason ? ': ' + w.rejectionReason : ''}`
                : w.status
            }
          />
        </Box>
      </SectionCard>

      {/* ── Section 3: Payment record (PAID only) ───────────────────────── */}
      {isPaid && (
        <SectionCard icon={<CheckCircleOutlined sx={{ fontSize: 19 }} />} title="Payment Record">
          <Box
            sx={{
              bgcolor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 2,
              px: 2.5,
              py: 0.5,
              mb: 2,
            }}
          >
            <InfoRow label="Transaction ID" value={w.transactionId || '—'} />
            <InfoRow label="Paid On" value={w.paidAt ? formatEventDate(w.paidAt) : '—'} />
          </Box>
          {w.proofUrl && (
            <Box>
              <Typography sx={{ fontSize: 13, color: MUTED, mb: 1 }}>Payment Proof:</Typography>
              <ProofButton withdrawalId={w.id} />
            </Box>
          )}
        </SectionCard>
      )}

      {/* ── Rejection reason (REJECTED only) ────────────────────────────── */}
      {isRejected && w.rejectionReason && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Rejection Reason</Typography>
          <Typography sx={{ fontSize: 13.5 }}>{w.rejectionReason}</Typography>
        </Alert>
      )}

      {/* ── Action cards (open requests only) ───────────────────────────── */}
      {isOpen && (
        <>
          {/* REQUESTED: only action is Start Processing */}
          {isRequested && (
            <Card variant="outlined" sx={{ borderRadius: 3, mb: 2.5, border: '1px solid #E0E7FF' }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: INK, mb: 0.75 }}>
                  Start Processing
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: MUTED, mb: 2.5 }}>
                  Confirm that you have reviewed this request and are beginning the manual bank
                  transfer to{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: INK }}>
                    {w.organizer?.upiId || w.upiId || '—'}
                  </Box>
                  . The status will change to Processing.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => withdrawalsApi.process(id),
                        'Status updated to Processing.',
                        'Could not start processing.',
                      )
                    }
                    sx={{
                      bgcolor: BLUE,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2.5,
                      px: 3,
                      '&:hover': { bgcolor: '#1D46C8' },
                    }}
                  >
                    {busy ? 'Working…' : 'Start Processing'}
                  </Button>
                  <Button
                    variant="text"
                    color="error"
                    disabled={busy}
                    onClick={() => setConfirmReject(true)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Reject Request
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* PROCESSING: enter transaction ID + proof, then Mark as Paid */}
          {isProcessing && (
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, mb: 2.5, border: '1px solid #D1FAE5' }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: INK, mb: 0.75 }}>
                  Confirm Payment
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: MUTED, mb: 2.5 }}>
                  Transfer{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: INK }}>
                    {formatINR(w.amount)}
                  </Box>{' '}
                  to UPI ID{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: INK }}>
                    {w.organizer?.upiId || w.upiId || '—'}
                  </Box>{' '}
                  manually, then record the payment details below.
                </Typography>

                {txnError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTxnError('')}>
                    {txnError}
                  </Alert>
                )}

                <TextField
                  label="Transaction ID *"
                  placeholder="e.g. TXN123456789"
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    setTxnError('');
                  }}
                  fullWidth
                  size="small"
                  sx={{ mb: 2 }}
                  error={!!txnError && !transactionId.trim()}
                />

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2.5 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    {screenshot ? 'Change Screenshot' : 'Upload Payment Screenshot *'}
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        setScreenshot(e.target.files?.[0] || null);
                        setTxnError('');
                      }}
                    />
                  </Button>
                  {screenshot && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={screenshot.name}
                        size="small"
                        onDelete={() => setScreenshot(null)}
                        sx={{ maxWidth: 220, fontSize: 12 }}
                      />
                    </Box>
                  )}
                  {!screenshot && (
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      jpeg / png / webp · max 5 MB
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={busy}
                    onClick={handleMarkPaid}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2.5,
                      px: 3,
                    }}
                  >
                    {busy ? 'Working…' : 'Mark as Paid'}
                  </Button>
                  <Button
                    variant="text"
                    color="error"
                    disabled={busy}
                    onClick={() => setConfirmReject(true)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Reject Request
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Reject confirm dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmReject}
        title="Reject withdrawal?"
        description={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              The organizer will see your reason. The reserved amount will be released and the
              organizer may submit a new request.
            </Typography>
            <TextField
              label="Rejection reason *"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="e.g. UPI ID mismatch — update it and request again"
            />
          </Box>
        }
        confirmLabel="Reject"
        busy={busy}
        onCancel={() => {
          setConfirmReject(false);
          setRejectReason('');
        }}
        onConfirm={() => {
          if (!rejectReason.trim()) {
            setActionError('Rejection reason is required.');
            setConfirmReject(false);
            return;
          }
          const reason = rejectReason.trim();
          setConfirmReject(false);
          setRejectReason('');
          run(
            () => withdrawalsApi.reject(id, reason),
            'Withdrawal rejected.',
            'Could not reject withdrawal.',
          );
        }}
      />
    </Box>
  );
}

export default function AdminWithdrawalDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminShell
      title="Withdrawal Request"
      subtitle="Review and process organizer payout."
      hideBrand
    >
      {id ? (
        <DetailContent id={id} />
      ) : (
        <ErrorState message="No withdrawal ID in URL." />
      )}
    </AdminShell>
  );
}
