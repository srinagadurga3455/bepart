import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, TodoPlaceholder } from '../components/LegalLayout';
import { BEPART_SUPPORT } from '../../app/config/support';

// Terms describing ONLY actual BePart behavior: OTP accounts, admin-created
// organizers, draft→preview→publish flow, deactivation cascade, paid/coupon
// handling, check-in, withdrawals. No invented guarantees.
export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="LEGAL · TERMS"
      title="Terms & Conditions"
      intro="The rules for using BePart as a participant, organizer or administrator."
    >
      <LegalSection title="1. What BePart is">
        <p>
          BePart provides campus event discovery, registration forms, digital tickets with QR
          codes, entry check-in, discount coupons, payment tracking and organizer payouts.
          Event content, pricing, schedules and entry decisions belong to the event’s organizer;
          BePart provides the tooling.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <ul>
          <li><strong>Sign-in is OTP-only.</strong> You sign in with a one-time passcode sent to your email or phone — there are no passwords.</li>
          <li><strong>Organizer accounts are created by an administrator</strong>, not by self-registration. If your organizer login does not work, ask your admin or contact {BEPART_SUPPORT.email}.</li>
          <li>You are responsible for keeping your email/phone access secure and for activity under your account.</li>
          <li>We may deactivate accounts that abuse the platform, submit false information, or violate these terms. Deactivated organizers lose access and their events are hidden from participants until reactivation.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. For participants">
        <ul>
          <li>Provide accurate registration details — organizers admit participants based on them.</li>
          <li>One registration per phone number per event, subject to available slots and the registration deadline.</li>
          <li>Tickets are personal to the registration unless the event explicitly covers teams.</li>
          <li>Entry requires a valid ticket QR; already-used or invalid codes are rejected at check-in.</li>
          <li>Coupons are validated once on the server; invalid, expired, inactive or exhausted coupons are rejected and no payment is created.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. For organizers">
        <ul>
          <li>You may create events (draft → preview → publish), custom registration forms, posters, fees and coupons for your own events only.</li>
          <li>Published events cannot be edited directly — cancel them if material changes are needed.</li>
          <li>You are responsible for your event’s accuracy (date, venue, price, capacity), for collecting payments you mark as received, and for honoring confirmed registrations.</li>
          <li>Withdrawals pay out collected fees to your saved UPI ID after admin processing with transaction proof.</li>
          <li>Content that is unlawful, misleading, or infringes others’ rights may be removed and your account deactivated.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Payments, coupons and payouts">
        <ul>
          <li>Paid-event amounts are handled in the smallest currency unit; coupon discounts are calculated once on the server and snapshotted on the payment/registration.</li>
          <li>Online payment is currently completed with the organizer; a registration is issued only after payment confirmation.</li>
          <li>Withdrawal state transitions (REQUESTED → PROCESSING → PAID, or REJECTED with a reason) are enforced and cannot be skipped or duplicated.</li>
        </ul>
        <TodoPlaceholder label="Payment provider name, settlement timelines and fee schedule, when applicable." />
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <ul>
          <li>No scraping, bulk ticket harvesting, QR forgery, or attempts to access other organizers’ data.</li>
          <li>No spam registrations, fake payments, or coupon abuse.</li>
          <li>No uploading unlawful or infringing content (posters, descriptions, proofs).</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Availability and liability">
        <p>
          BePart is provided on an “as is” basis. We work to keep it reliable but do not guarantee
          uninterrupted availability. To the maximum extent permitted by law, BePart is not liable
          for organizer decisions (cancellations, entry refusal, refunds) or for losses arising
          from your use of the platform.
        </p>
        <TodoPlaceholder label="Liability cap, governing law and dispute-resolution venue." />
      </LegalSection>

      <LegalSection title="8. Changes">
        <p>We may update these terms; the “last updated” date above will change and continued use means acceptance.</p>
      </LegalSection>

      <Typography variant="caption" color="text.secondary">
        These terms describe the product as implemented. They are not legal advice — have counsel review before public launch.
      </Typography>
    </LegalLayout>
  );
}
