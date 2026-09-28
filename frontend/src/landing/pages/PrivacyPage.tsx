import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, TodoPlaceholder } from '../components/LegalLayout';
import { BEPART_SUPPORT } from '../../app/config/support';

// Privacy Policy describing ONLY what BePart actually does today:
// OTP login, registration answers shared with organizers, tickets/QR,
// payments snapshots, withdrawal payouts. No invented data practices.
export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="LEGAL · PRIVACY"
      title="Privacy Policy"
      intro="How BePart collects, uses and protects your information when you discover events, register, pay, or host as an organizer."
    >
      <LegalSection title="1. Who we are">
        <p>
          BePart (“we”, “us”) operates the BePart event registration and ticketing platform.
          You can reach us at {BEPART_SUPPORT.email} or {BEPART_SUPPORT.phone}.
        </p>
        <TodoPlaceholder label="Legal entity name, registered address and jurisdiction/country for governing law." />
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul>
          <li><strong>Contact & identity:</strong> name, email address and/or phone number you provide at sign-in or registration.</li>
          <li><strong>Login security:</strong> one-time passcodes (stored only as cryptographic hashes), login timestamps and attempt counts used to prevent abuse.</li>
          <li><strong>Registration answers:</strong> whatever you type into an organizer’s custom registration form (including team-member details).</li>
          <li><strong>Ticket & attendance:</strong> your registration record, ticket identifier, QR payload and check-in time.</li>
          <li><strong>Payments:</strong> amount paid, pricing snapshot (original, discount, coupon code) and payment status. We do not process card/bank payments in-app today — paid-event completion happens with the organizer.</li>
          <li><strong>Organizer payouts:</strong> organizer UPI IDs, withdrawal amounts, transaction IDs and payment screenshots uploaded as proof.</li>
          <li><strong>Event content:</strong> event details, posters and form structures created by organizers.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <ul>
          <li>To create and verify your account (OTP sign-in) and keep it secure.</li>
          <li>To register you for events and issue digital tickets with QR codes.</li>
          <li>To share your registration answers with the organizer of that event, so they can manage participants and entry.</li>
          <li>To confirm payments, apply coupons, and settle organizer payouts.</li>
          <li>To operate, troubleshoot and improve the platform, and to contact you about support requests.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection title="4. Who sees your information">
        <ul>
          <li><strong>Event organizers</strong> see registrations for their own events (answers, phone, payment and check-in state).</li>
          <li><strong>Platform administrators</strong> see platform data needed to run support, review organizers and settle payouts.</li>
          <li><strong>Infrastructure providers</strong> (hosting, database, file storage) process data only to provide their service.</li>
        </ul>
        <TodoPlaceholder label="Names of hosting / database / storage / payment providers, and their regions." />
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          Registration, ticket and payment records are kept while your account is active and as needed
          for accounting, dispute handling and legal compliance. You may ask for deletion (see §7);
          some records (e.g. payout proofs) may be retained longer where the law requires.
        </p>
        <TodoPlaceholder label="Exact retention periods per data category and applicable law." />
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          We use OTP-based sign-in (no stored passwords), role-based access control (participant,
          organizer, admin), organizer-scoped data access, and authenticated ticket/check-in flows.
          No system is perfectly secure; report suspected abuse to {BEPART_SUPPORT.email}.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <ul>
          <li>Access, correct or delete your personal information by contacting {BEPART_SUPPORT.email}.</li>
          <li>Cancel upcoming registrations from your dashboard, which removes them from the organizer’s active list.</li>
          <li>Ask what data an organizer holds about you — we will help route the request.</li>
        </ul>
        <TodoPlaceholder label="Jurisdiction-specific rights (e.g. GDPR / DPDP Act references) and response timelines." />
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          BePart is designed for campus events. If you are under the age required to consent to
          data processing in your country, please use BePart only with a parent/guardian.
        </p>
        <TodoPlaceholder label="Minimum age and parental-consent process." />
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          We will update this page and the “last updated” date when our practices change.
          Continued use of BePart after changes means you accept the updated policy.
        </p>
      </LegalSection>

      <Typography variant="caption" color="text.secondary">
        This policy describes the product as implemented. It is not legal advice — have counsel review before public launch.
      </Typography>
    </LegalLayout>
  );
}
