import React from "react";
import { LegalPage, Section, P, Bullet, Strong, COMPANY_NAME, SUPPORT_EMAIL } from "@/src/components/legal-page";

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle={`${COMPANY_NAME} is designed to work with the minimum data we need to analyse your conversations. This page tells you exactly what we collect, why, how long we keep it, and what control you have over it.`}
    >
      <Section heading="Short version">
        <Bullet>You can use most of {COMPANY_NAME} anonymously — no sign-in required.</Bullet>
        <Bullet>We store your analyses so you can see them in History. You can delete any single one or your whole account at any time.</Bullet>
        <Bullet>The text, screenshot, or voice note of each analysis is sent to an AI model (OpenAI) only to produce your scorecard, then discarded by them per their enterprise retention policy.</Bullet>
        <Bullet>We do not sell your data, do not advertise against it, and do not share it with insurers, employers, courts, or law-enforcement unless legally compelled.</Bullet>
      </Section>

      <Section heading="1. What we collect">
        <P>
          <Strong>Device identifier.</Strong> Each install creates a random anonymous ID stored on
          your device. We use it to scope your history and free-quota count. It is not linked to
          your real identity unless you choose to sign in.
        </P>
        <P>
          <Strong>Account data (optional).</Strong> If you sign in with Apple or Google, we
          receive a stable user id and (optionally) an email. We never see your password.
        </P>
        <P>
          <Strong>Your submitted content.</Strong> The transcripts, screenshots, and voice notes
          you upload for analysis, plus the AI's generated scorecard, verdict, trait pills, and
          notable quotes. These are stored in our database so you can review them in History.
        </P>
        <P>
          <Strong>Billing data.</Strong> If you subscribe to Pro, your name, email, and payment
          details are collected by <Strong>Stripe</Strong> (web) or <Strong>Apple</Strong> (iOS).
          We never see your card number — we only see a billing status flag and a Stripe
          customer id (web) or an entitlement (iOS).
        </P>
        <P>
          <Strong>Operational logs.</Strong> IP address, user-agent, and basic request logs are
          kept for 30 days for abuse prevention and incident response, then automatically purged.
        </P>
        <P>
          <Strong>We do NOT collect:</Strong> precise location, contacts, your camera roll beyond
          the single screenshot you upload, biometric data, or your microphone audio beyond the
          single voice note you record.
        </P>
      </Section>

      <Section heading="2. Why we collect it (legal bases)">
        <Bullet><Strong>To provide the Service</Strong> you asked for — the analysis itself (contractual necessity).</Bullet>
        <Bullet><Strong>To keep your history</Strong> available to you between sessions (contractual necessity).</Bullet>
        <Bullet><Strong>To take payment and prevent fraud</Strong> (contractual necessity + legitimate interest).</Bullet>
        <Bullet><Strong>To debug, prevent abuse, and comply with the law</Strong> (legitimate interest + legal obligation).</Bullet>
        <Bullet><Strong>To improve the model</Strong> only with aggregated and de-identified signal; never with your raw conversations.</Bullet>
      </Section>

      <Section heading="3. Who processes your data on our behalf">
        <P>We use a small set of vetted sub-processors:</P>
        <Bullet><Strong>OpenAI</Strong> — runs the AI analysis and voice transcription. Governed by OpenAI's enterprise data-processing addendum; they do not train models on our customer data.</Bullet>
        <Bullet><Strong>Stripe</Strong> — processes web subscriptions and stores billing data.</Bullet>
        <Bullet><Strong>Apple</Strong> — processes iOS in-app purchases and Apple Sign-In.</Bullet>
        <Bullet><Strong>Google</Strong> — processes Google Sign-In if you choose it.</Bullet>
        <Bullet><Strong>MongoDB Atlas</Strong> — stores your account, history, and entitlements inside a cloud database in the United States.</Bullet>
        <Bullet><Strong>Emergent</Strong> — hosts the application and preview environment.</Bullet>
      </Section>

      <Section heading="4. How long we keep it">
        <Bullet><Strong>Submitted content and analyses:</Strong> until you delete them, or indefinitely while you're an active user.</Bullet>
        <Bullet><Strong>Account record:</Strong> until you delete the account, then soft-deleted for 30 days (for recovery) and permanently purged.</Bullet>
        <Bullet><Strong>Billing records:</Strong> kept by Stripe/Apple for at least 7 years as required by tax and financial regulations.</Bullet>
        <Bullet><Strong>Operational logs:</Strong> 30 days.</Bullet>
      </Section>

      <Section heading="5. Your rights">
        <P>Depending on where you live you have some or all of these rights:</P>
        <Bullet><Strong>Access</Strong> — see what we have about you.</Bullet>
        <Bullet><Strong>Rectify</Strong> — correct inaccurate data.</Bullet>
        <Bullet><Strong>Delete</Strong> — ask us to erase your data (also available in-app via Settings → Delete Account).</Bullet>
        <Bullet><Strong>Port</Strong> — get a copy of your data in a machine-readable format.</Bullet>
        <Bullet><Strong>Object or restrict</Strong> — tell us to stop certain processing.</Bullet>
        <Bullet><Strong>Opt out</Strong> — if you are a California resident, you can opt out of "sale" or "sharing" of your data. We do not sell it today.</Bullet>
        <P>To exercise any of these, email {SUPPORT_EMAIL} from the address on your account.</P>
      </Section>

      <Section heading="6. Children">
        <P>
          {COMPANY_NAME} is not directed at children under 18. If we discover that an account
          belongs to a child, we will delete it. If you believe a child is using the Service,
          please contact us.
        </P>
      </Section>

      <Section heading="7. International transfers">
        <P>
          Our servers run in the United States. If you are using {COMPANY_NAME} from the EEA, UK,
          or Switzerland, your data will be transferred to the US. Our processors use Standard
          Contractual Clauses or equivalent safeguards to protect that transfer.
        </P>
      </Section>

      <Section heading="8. Security">
        <P>
          We encrypt data in transit (TLS 1.2+) and at rest, run least-privilege access controls,
          and keep audit logs. No system is perfectly secure, but we treat your conversations as
          sensitive by default.
        </P>
      </Section>

      <Section heading="9. Breach notification">
        <P>
          If a breach ever affects your personal data, we will notify you and the appropriate
          regulators without undue delay and in any event within 72 hours of becoming aware of
          it, where legally required.
        </P>
      </Section>

      <Section heading="10. Changes to this policy">
        <P>
          If we materially change this Privacy Policy, we will update the effective date above
          and, where feasible, show an in-app notice the next time you open the app. Continued
          use after the change counts as acceptance.
        </P>
      </Section>

      <Section heading="11. Contact">
        <P>
          Privacy requests, questions, or complaints can be sent to {SUPPORT_EMAIL}. If you are
          in the EU/UK you also have the right to complain to your local data-protection
          authority.
        </P>
      </Section>
    </LegalPage>
  );
}
