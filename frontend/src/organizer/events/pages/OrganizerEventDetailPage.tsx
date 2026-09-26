import { Fragment, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../api/events';
import { organizersApi } from '../../account/api/organizers';
import { registrationsApi } from '../api/registrations';
import { withdrawalsApi } from '../../withdrawals/api/withdrawals';
import { unwrapList, apiErrorMessage } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import { registrantName, eventFee } from '../utils/eventData';
import type { FormDataRecord, FormStructure, RegistrationItem, WithdrawalItem } from '../../../app/types';
import OrganizerShell from '../../components/OrganizerShell';
import {
  orgCardSx,
  orgSectionTitleSx,
  orgSmallButtonSx,
  orgTableBodyCellSx,
  orgTableContainerSx,
  orgTableHeadCellSx,
  orgTableHeadRowSx,
} from '../../components/organizerStyles';
import WithdrawDialog from '../../withdrawals/components/WithdrawDialog';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
}

function formatValue(v: FormDataRecord[string]): string {
  if (Array.isArray(v)) return v.join(', ');
  return String(v ?? '—');
}

// Renders one registration's submitted values using the event's own form structure.
function RegistrationFormData({
  formStructure,
  formData,
}: {
  formStructure: FormStructure | null | undefined;
  formData: FormDataRecord | null | undefined;
}) {
  const sections = formStructure?.sections || [];
  if (sections.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Object.entries(formData || {}).map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">{k}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{formatValue(v)}</Typography>
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sections.map((section) => {
        const fields = (section.fields || []).filter((f) => !isEmptyValue(formData?.[f.name]));
        if (fields.length === 0) return null;
        return (
          <Box key={section.id}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>{section.title}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {fields.map((f) => (
                <Box key={f.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{formatValue(formData?.[f.name])}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function DetailContent({ id }: { id: string | undefined }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: eventRes, isLoading } = useQuery({
    queryKey: ['organizer-event', id], queryFn: () => eventsApi.get(id!),
  });
  const { data: regsRes } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });
  const { data: orgRes } = useQuery({
    queryKey: ['organizer', 'me'], queryFn: () => organizersApi.getMe(),
  });
  const { data: wdsRes } = useQuery({
    queryKey: ['withdrawals', 'mine'], queryFn: () => withdrawalsApi.mine(),
  });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [requestedMsg, setRequestedMsg] = useState('');

  const event = eventRes?.data;
  const eventId = parseInt(id ?? '', 10);
  const registrations: RegistrationItem[] = unwrapList<RegistrationItem>(regsRes).filter(
    (r) => r.eventId === eventId
  );
  const myWithdrawals: WithdrawalItem[] = unwrapList<WithdrawalItem>(wdsRes).filter(
    (w) => w.eventId === eventId
  );
  const fee = event ? eventFee(event) : 0;
  const collected = registrations.length * fee;
  const openWd = myWithdrawals.find((w) => ['REQUESTED', 'PROCESSING'].includes(w.status)) || null;
  const paidTotal = myWithdrawals.filter((w) => w.status === 'PAID').reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const available = Math.max(0, collected - paidTotal - (openWd ? Number(openWd.amount) || 0 : 0));
  const canWithdraw = collected > 0 && available > 0 && !openWd && !!orgRes?.data?.upiId;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['organizer-event', id] });
    queryClient.invalidateQueries({ queryKey: ['events', 'my'] });
    queryClient.invalidateQueries({ queryKey: ['withdrawals', 'mine'] });
  };

  const act = async (fn: (eid: number) => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await fn(event!.id);
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  if (!event) {
    return <Alert severity="error">Event not found.</Alert>;
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card variant="outlined" sx={{ ...orgCardSx, mb: 3 }}>
        {event.posterUrl && (
          <Box component="img" src={event.posterUrl} alt={`${event.eventName} poster`}
            sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: '12px 12px 0 0' }} />
        )}
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <Chip label={event.status} size="small" variant="outlined" color={event.status === 'PUBLISHED' ? 'success' : 'default'} />
            <Chip label={event.paymentRequired ? `Paid${event.formStructure?.payment?.amount ? ` · ₹${event.formStructure.payment.amount}` : ''}` : 'Free'} size="small" variant="outlined" color={event.paymentRequired ? 'primary' : 'default'} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }} gutterBottom>
            {event.eventName}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{event.description || 'No description.'}</Typography>
          <Typography variant="body2" color="text.secondary">
            Date: {formatEventDate(event.date)} · Deadline: {formatEventDate(event.closingTime)} · Capacity: {event.slots} · Registrations: {registrations.length}
          </Typography>

          <Divider sx={{ my: 2.5 }} />

          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>Payments</Typography>
          {requestedMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRequestedMsg('')}>{requestedMsg}</Alert>}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Registrations</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{registrations.length}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Amount Collected</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{formatINR(collected)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Payment Status</Typography>
              <Box sx={{ mt: 0.5 }}>
                {openWd ? (
                  <WithdrawalStatusChip status={openWd.status} />
                ) : paidTotal > 0 ? (
                  <WithdrawalStatusChip status="PAID" />
                ) : (
                  <Chip label={collected > 0 ? 'Pending' : 'No collections yet'} size="small" variant="outlined" color={collected > 0 ? 'warning' : 'default'} />
                )}
              </Box>
            </Box>
          </Box>
          {openWd && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {formatINR(openWd.amount)} requested on {formatEventDate(openWd.requestedAt)}. Waiting for admin payment confirmation.
            </Typography>
          )}
          {canWithdraw && (
            <Button size="small" variant="contained" color="success" onClick={() => setWithdrawOpen(true)} sx={{ mb: 1, ...orgSmallButtonSx, boxShadow: 'none' }}>
              Withdraw {formatINR(available)}
            </Button>
          )}
          {withdrawOpen && (
            <WithdrawDialog
              open
              event={event}
              finance={{ collected }}
              withdrawals={myWithdrawals}
              upiId={orgRes?.data?.upiId}
              onClose={() => setWithdrawOpen(false)}
              onRequested={() => {
                refresh();
                setRequestedMsg('Withdrawal requested. Status: pending admin processing.');
              }}
            />
          )}

          <Divider sx={{ my: 2.5 }} />

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {event.status !== 'PUBLISHED' && (
              <Button size="small" variant="contained" component={RouterLink} to={`/organizer/events/${event.id}/edit`} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                {event.status === 'DRAFT' ? 'Continue Editing' : 'Edit'}
              </Button>
            )}
            {event.status === 'DRAFT' && (
              <Button size="small" variant="outlined" disabled={busy} onClick={() => act((eid) => eventsApi.preview(eid))} sx={{ ...orgSmallButtonSx }}>
                {busy ? 'Working…' : 'Move to Preview'}
              </Button>
            )}
            {event.status === 'PREVIEW' && (
              <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => act((eid) => eventsApi.publish(eid))} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                {busy ? 'Publishing…' : 'Publish'}
              </Button>
            )}
            {event.status === 'PUBLISHED' && (
              <Button size="small" variant="outlined" component={RouterLink} to={`/events/${event.id}`} sx={{ ...orgSmallButtonSx }}>
                View Public Page
              </Button>
            )}
            {event.status !== 'PUBLISHED' && event.status !== 'CANCELLED' && (
              <Button
                size="small"
                color="error"
                disabled={busy}
                sx={{ ...orgSmallButtonSx }}
                onClick={() => {
                  if (!confirmCancel) { setConfirmCancel(true); return; }
                  setConfirmCancel(false);
                  act((eid) => eventsApi.cancel(eid));
                }}
              >
                {confirmCancel ? 'Click again to confirm cancel' : 'Cancel Event'}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ ...orgCardSx }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>
            Registrations ({registrations.length})
          </Typography>
          {registrations.length === 0 ? (
            <Alert severity="info">No registrations yet.</Alert>
          ) : (
            <TableContainer sx={{ ...orgTableContainerSx }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow sx={{ ...orgTableHeadRowSx }}>
                    <TableCell sx={{ ...orgTableHeadCellSx }}>Registrant / Team</TableCell>
                    <TableCell sx={{ ...orgTableHeadCellSx }}>Phone</TableCell>
                    <TableCell sx={{ ...orgTableHeadCellSx }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registrations.map((r) => (
                    <Fragment key={r.registrationId}>
                      <TableRow>
                        <TableCell sx={{ ...orgTableBodyCellSx }}>{registrantName(r.formData)}</TableCell>
                        <TableCell sx={{ ...orgTableBodyCellSx }}>{r.phone}</TableCell>
                        <TableCell sx={{ ...orgTableBodyCellSx }}>{formatEventDate(r.createdAt)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} sx={{ bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Accordion elevation={0} sx={{ bgcolor: 'transparent' }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                                View submitted details
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <RegistrationFormData formStructure={event.formStructure} formData={r.formData} />
                            </AccordionDetails>
                          </Accordion>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default function OrganizerEventDetailPage() {
  const { id } = useParams();
  return (
    <OrganizerShell hideSearch hideCreate>
      <DetailContent id={id} />
    </OrganizerShell>
  );
}
