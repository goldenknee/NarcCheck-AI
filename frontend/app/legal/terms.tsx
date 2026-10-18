import React from "react";
import { LegalPage, Section, P, Bullet, Strong, COMPANY_NAME, SUPPORT_EMAIL } from "@/src/components/legal-page";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle={`Welcome to ${COMPANY_NAME}. These Terms govern your use of our website, mobile apps, and the AI analyses they provide. By creating an account, subscribing, or using the Service you agree to them.`}
    >
      <Section heading="1. Who we are">
        <P>
          {COMPANY_NAME} ("we", "us", "our") provides an AI-assisted tool that analyses
          conversation transcripts, screenshots, and voice notes to produce an opinion about
          communication patterns between the people in them. We are the data controller for the
          account data you give us.
        </P>
      </Section>

      <Section heading="2. The important disclaimer">
        <P>
          <Strong>{COMPANY_NAME} is an entertainment and self-reflection tool. It is not a
          substitute for professional advice.</Strong> The scores, trait pills, verdicts, and
          written analyses we generate are AI-generated opinions based solely on the text or audio
          you provide. They are not:
        </P>
        <Bullet>a mental-health diagnosis of any individual;</Bullet>
        <Bullet>a legal, medical, psychological, or psychiatric opinion;</Bullet>
        <Bullet>a determination that a person is a narcissist, abuser, or victim;</Bullet>
        <Bullet>admissible evidence in any court, custody dispute, or arbitration;</Bullet>
        <Bullet>a prediction of future behaviour.</Bullet>
        <P>
          If you believe you are in an abusive relationship, in crisis, or in danger, please
          contact a licensed professional, a domestic-abuse hotline, or local emergency services.
          Do not rely on {COMPANY_NAME} for decisions that affect your safety, finances, legal
          rights, or custody arrangements.
        </P>
      </Section>

      <Section heading="3. Eligibility">
        <P>
          You must be at least 18 years old and legally able to form a binding contract in your
          jurisdiction. The Service is not directed at children, and we do not knowingly collect
          data from anyone under 18.
        </P>
      </Section>

      <Section heading="4. Your account and content">
        <P>
          You can use most of {COMPANY_NAME} anonymously. If you sign in with Apple or Google we
          create a persistent account tied to that identity so your history can sync across your
          devices.
        </P>
        <P>
          <Strong>You own what you paste in.</Strong> You keep all rights to the conversation
          transcripts, screenshots, and voice notes you submit ("User Content"). You grant us a
          narrow licence to process that User Content only for the purpose of returning the
          analysis you asked for, improving our service aggregated and de-identified, and keeping
          your history available to you.
        </P>
        <P>
          <Strong>You must have the right to submit the content.</Strong> By uploading, you
          confirm that you were a party to the conversation, that you have consent from the other
          parties where legally required (one-party and all-party consent states vary), and that
          you will comply with any applicable recording and privacy laws.
        </P>
      </Section>

      <Section heading="5. Prohibited uses">
        <P>You agree not to use {COMPANY_NAME} to:</P>
        <Bullet>harass, dox, defame, or stalk another person;</Bullet>
        <Bullet>upload content you obtained by hacking, phishing, or breaking a device password;</Bullet>
        <Bullet>upload content involving minors in a sexualised or exploitative context;</Bullet>
        <Bullet>reverse-engineer the AI model, scrape outputs at scale, or resell them;</Bullet>
        <Bullet>circumvent subscription limits or the free-quota system.</Bullet>
      </Section>

      <Section heading="6. Subscriptions, billing, and refunds">
        <P>
          <Strong>Free tier.</Strong> You get three analyses per device for free. After that you
          need an active NarcCheck Pro subscription.
        </P>
        <P>
          <Strong>Web (Stripe).</Strong> On our website, Pro is billed by Stripe at $8.99 per
          month or $60 per year. Subscriptions auto-renew at the end of each billing cycle until
          you cancel. Cancel any time from the Stripe-hosted Customer Portal reachable from the
          Settings screen; your access continues until the end of the paid period.
        </P>
        <P>
          <Strong>iOS App Store.</Strong> On the mobile app, Pro is billed by Apple at the same
          tiers. Apple handles payment, renewal, and cancellation per their standard subscription
          rules. Manage or cancel from <Strong>Settings → Apple ID → Subscriptions</Strong> on
          your device.
        </P>
        <P>
          <Strong>Refunds.</Strong> We don't issue partial refunds for the current billing
          period. If you believe you were billed in error, email {SUPPORT_EMAIL} within 7 days
          and we'll review. App Store refunds must go through Apple.
        </P>
      </Section>

      <Section heading="7. Intellectual property">
        <P>
          The {COMPANY_NAME} name, logo, design, prompts, and software are our property. You may
          not copy, modify, or resell them. The underlying AI model is licensed from a third
          party and governed by their terms as well.
        </P>
      </Section>

      <Section heading="8. Limitation of liability">
        <P>
          To the maximum extent allowed by law, {COMPANY_NAME} and its officers, employees, and
          partners will not be liable for any indirect, incidental, special, consequential, or
          punitive damages, or for any loss of data, profits, reputation, relationships, or
          emotional wellbeing, arising from your use of the Service. Our total aggregate liability
          will not exceed the amount you paid us in the 12 months before the claim.
        </P>
      </Section>

      <Section heading="9. Termination">
        <P>
          You can delete your account at any time from <Strong>Settings → Delete Account</Strong>.
          We can suspend or terminate your access if you breach these Terms. Sections 2, 7, 8, 10,
          and 11 survive termination.
        </P>
      </Section>

      <Section heading="10. Governing law">
        <P>
          These Terms are governed by the laws of the State of Florida, USA, without regard to
          its conflict-of-laws rules. Any dispute arising from these Terms will be resolved
          exclusively in the state or federal courts located in the State of Florida, and you
          consent to that jurisdiction and venue. If you are a consumer resident in another
          jurisdiction, mandatory consumer protections in your home jurisdiction still apply.
        </P>
      </Section>

      <Section heading="11. Changes">
        <P>
          We may update these Terms as the Service evolves. Material changes will be posted on
          this page with a new effective date and, where feasible, surfaced in-app the next time
          you open it. Continued use after the change means you accept the updated Terms.
        </P>
      </Section>

      <Section heading="12. Contact">
        <P>Questions, DMCA notices, or legal process should go to {SUPPORT_EMAIL}.</P>
      </Section>
    </LegalPage>
  );
}
