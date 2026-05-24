import { createTransport } from "nodemailer";

import type { Logger } from "@usercore/logger";

import { env } from "../../env";
import {
  emailDecisionT,
  emailResubmissionT,
  emailT,
  type EmailLocale,
} from "./emailI18n";

// Two-letter capitalised initial — falls back to "?" so the tile never renders
// blank. Used as the in-email logo when no brand logo URL is available.
const brandInitial = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
};

// Quote the friendly name when composing the From header — RFC 5322 requires
// it if the display contains commas, quotes, or other specials. Plain
// alphanumerics technically don't need quoting but quoting never hurts.
const escapeFromName = (name: string) =>
  `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const LOGO_CID = "brand-logo";

const wrap = (props: {
  innerHtml: string;
  brandName: string;
  primaryColor: string;
  hasLogo: boolean;
}) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 40px auto; padding: 32px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      ${
        props.hasLogo
          ? `<img src="cid:${LOGO_CID}" alt="${props.brandName}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 12px;" />`
          : `<div style="display: inline-block; width: 48px; height: 48px; background: ${props.primaryColor}; border-radius: 12px; line-height: 48px; font-weight: 700; color: #ffffff; font-size: 20px;">${brandInitial(props.brandName)}</div>`
      }
    </div>
    ${props.innerHtml}
  </div>
`;

export const createMailer = (props: { logger: Logger }) => {
  const { logger } = props;
  const transport = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });

  const sendVerificationOtp = async (data: {
    to: string;
    otp: string;
    brandName: string;
    primaryColor: string;
    // Raw bytes + content type for the brand logo. Attached as a CID
    // inline attachment so email clients render it from the message body
    // (no public URL needed — works behind localhost MinIO).
    logo: { body: Buffer; contentType: string } | null;
    // Per-workflow custom From address (Enterprise plan). null falls back
    // to the platform default in env.SMTP_FROM.
    senderEmail: string | null;
    locale: EmailLocale | string | null | undefined;
  }) => {
    const vars = { brand: data.brandName };
    const subject = emailT(data.locale, "subject", vars);
    const heading = emailT(data.locale, "heading", vars);
    const intro = emailT(data.locale, "intro", vars);
    const expiresIn = emailT(data.locale, "expiresIn", vars);
    const scamNote = emailT(data.locale, "scamNote", vars);

    const html = wrap({
      brandName: data.brandName,
      primaryColor: data.primaryColor,
      hasLogo: data.logo !== null,
      innerHtml: `
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">${heading}</h2>
        <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; text-align: center;">${intro}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 12px; color: #111827;">${data.otp}</div>
        <p style="margin: 24px 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">${expiresIn}</p>
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">${scamNote}</p>
      `,
    });
    const fromAddress = data.senderEmail ?? env.SMTP_FROM;
    await transport.sendMail({
      from: `${escapeFromName(data.brandName)} <${fromAddress}>`,
      to: data.to,
      subject,
      html,
      text: `${heading}\n\n${intro}\n\n${data.otp}\n\n${expiresIn}\n\n${scamNote}`,
      attachments: data.logo
        ? [
            {
              cid: LOGO_CID,
              filename: `brand-logo`,
              content: data.logo.body,
              contentType: data.logo.contentType,
            },
          ]
        : undefined,
    });
    logger.info({
      msg: "Verification OTP sent",
      to: data.to,
      from: fromAddress,
    });
  };

  const sendResubmissionRequest = async (data: {
    to: string;
    brandName: string;
    primaryColor: string;
    logo: { body: Buffer; contentType: string } | null;
    senderEmail: string | null;
    locale: EmailLocale | string | null | undefined;
    // Optional officer note ("your ID photo was blurry").
    note: string | null;
    // Deep link back into the widget so the customer resumes the flow.
    resumeUrl: string;
  }) => {
    const vars = { brand: data.brandName };
    const subject = emailResubmissionT(data.locale, "subject", vars);
    const heading = emailResubmissionT(data.locale, "heading", vars);
    const intro = emailResubmissionT(data.locale, "intro", vars);
    const cta = emailResubmissionT(data.locale, "cta", vars);

    const noteHtml = data.note
      ? `<p style="margin: 0 0 24px; font-size: 14px; color: #374151; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px;">${data.note}</p>`
      : "";

    const html = wrap({
      brandName: data.brandName,
      primaryColor: data.primaryColor,
      hasLogo: data.logo !== null,
      innerHtml: `
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">${heading}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280; text-align: center;">${intro}</p>
        ${noteHtml}
        <div style="text-align: center;">
          <a href="${data.resumeUrl}" style="display: inline-block; padding: 12px 20px; background: ${data.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">${cta}</a>
        </div>
      `,
    });
    const fromAddress = data.senderEmail ?? env.SMTP_FROM;
    await transport.sendMail({
      from: `${escapeFromName(data.brandName)} <${fromAddress}>`,
      to: data.to,
      subject,
      html,
      text: `${heading}\n\n${intro}${data.note ? `\n\n${data.note}` : ""}\n\n${cta}: ${data.resumeUrl}`,
      attachments: data.logo
        ? [
            {
              cid: LOGO_CID,
              filename: `brand-logo`,
              content: data.logo.body,
              contentType: data.logo.contentType,
            },
          ]
        : undefined,
    });
    logger.info({
      msg: "Resubmission request sent",
      to: data.to,
      from: fromAddress,
    });
  };

  // Final decision (approved/rejected) notice. Mirrors the resubmission mail:
  // localized strings, brand logo as a CID attachment, deep link to reopen.
  const sendDecisionNotice = async (data: {
    to: string;
    brandName: string;
    primaryColor: string;
    logo: { body: Buffer; contentType: string } | null;
    senderEmail: string | null;
    locale: EmailLocale | string | null | undefined;
    decision: "approved" | "rejected";
    resumeUrl: string;
  }) => {
    const vars = { brand: data.brandName };
    const subject = emailDecisionT(data.decision, data.locale, "subject", vars);
    const heading = emailDecisionT(data.decision, data.locale, "heading", vars);
    const intro = emailDecisionT(data.decision, data.locale, "intro", vars);
    const cta = emailDecisionT(data.decision, data.locale, "cta", vars);

    const html = wrap({
      brandName: data.brandName,
      primaryColor: data.primaryColor,
      hasLogo: data.logo !== null,
      innerHtml: `
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">${heading}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280; text-align: center;">${intro}</p>
        <div style="text-align: center;">
          <a href="${data.resumeUrl}" style="display: inline-block; padding: 12px 20px; background: ${data.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">${cta}</a>
        </div>
      `,
    });
    const fromAddress = data.senderEmail ?? env.SMTP_FROM;
    await transport.sendMail({
      from: `${escapeFromName(data.brandName)} <${fromAddress}>`,
      to: data.to,
      subject,
      html,
      text: `${heading}\n\n${intro}\n\n${cta}: ${data.resumeUrl}`,
      attachments: data.logo
        ? [
            {
              cid: LOGO_CID,
              filename: `brand-logo`,
              content: data.logo.body,
              contentType: data.logo.contentType,
            },
          ]
        : undefined,
    });
    logger.info({
      msg: "Decision notice sent",
      to: data.to,
      from: fromAddress,
      decision: data.decision,
    });
  };

  return { sendVerificationOtp, sendResubmissionRequest, sendDecisionNotice };
};

export type Mailer = ReturnType<typeof createMailer>;
