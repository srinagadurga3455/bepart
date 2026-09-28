import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, TodoPlaceholder } from '../components/LegalLayout';

// Refund & cancellation policy grounded in ACTUAL behavior: participant cancel
// via dashboard, organizer-confirmed paid flow, no automatic online refunds,
// organizer-owned refund decisions, withdrawal rejection releases amounts.
export default function RefundsPage() {
  return (
    <LegalLayout
      eyebrow="LEGAL · REFUNDS"
      title="Refund & Cancellation Policy"
      intro="How cancellations and refunds work on BePart today — for participants and organizers."
    >
      <LegalSection title="1. Cancelling your registration (participants)">
        <ul>
          <li>You can cancel any <strong>upcoming</strong> registration from My Tickets (sign in first). Cancelled registrations are removed from the organizer’s active list immediately.</li>
          <li>Cancellation is free and instant in the app. Whether money comes back depends on §2 below.</li>
          <li>Past events cannot be cancelled.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Refunds for paid events">
        <ul>
          <li><strong>Free events</strong> involve no payment, so there is nothing to refund.</li>
          <li><strong>Paid events</strong> are currently completed with the organizer (online payment is not enabled in-app). If you paid and then cancel — or the event is cancelled — <strong>the refund is issued by the event organizer</strong>, not automatically by BePart.</li>
          <li>To request a refund, contact the organizer first (details on the event page/ticket), then the BePart team if the organizer is unresponsive.</li>
          <li>Pending (unconfirmed) payments create no registration and no charge inside BePart, so there is nothing to refund for them.</li>
        </ul>
        <TodoPlaceholder label="Refund timelines (e.g. 5–7 business days), refund method, and any non-refundable fee situations." />
      </LegalSection>

      <LegalSection title="3. If the organizer cancels or changes an event">
        <ul>
          <li>Organizers can cancel events; cancelled events immediately disappear from discovery and registration.</li>
          <li>If you already paid for a cancelled event, you are entitled to a refund from the organizer — contact them with your ticket details.</li>
          <li>Published events cannot be silently edited; material changes require cancellation, so the listing you registered for is the listing you get.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Coupons and pricing">
        <ul>
          <li>Coupon discounts are calculated once on the server at payment initiation; the payable amount, original price and discount are snapshotted on your payment.</li>
          <li>If a registration is cancelled, any refund is based on the <strong>final payable amount</strong> in that snapshot.</li>
          <li>Used coupons are consumed and cannot be re-applied to a new registration beyond their usage limit.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Organizer payouts (withdrawals)">
        <ul>
          <li>Withdrawal requests move REQUESTED → PROCESSING → PAID, or are REJECTED with a written reason.</li>
          <li>A rejected withdrawal releases the amount — you can submit a new request.</li>
          <li>Paid withdrawals carry a transaction ID and a payment screenshot as proof, visible to the organizer.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. How to raise a refund issue">
        <ul>
          <li>Step 1: contact the event organizer with your ticket/phone number.</li>
          <li>Step 2: if unresolved, contact BePart support (details below) with the event name, ticket ID and payment evidence — we will investigate and mediate.</li>
        </ul>
        <TodoPlaceholder label="Support SLA / escalation matrix for refund disputes." />
      </LegalSection>

      <Typography variant="caption" color="text.secondary">
        This policy describes the product as implemented. It is not legal advice — have counsel review before public launch.
      </Typography>
    </LegalLayout>
  );
}
