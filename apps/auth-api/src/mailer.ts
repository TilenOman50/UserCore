import { createTransport } from "nodemailer";

import type { Logger } from "@usercore/logger";

import { env } from "./env";

const wrap = (innerHtml: string) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 40px auto; padding: 32px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: #C0E1D2; border-radius: 12px; line-height: 48px; font-weight: 700; color: #2f6048;">UC</div>
    </div>
    ${innerHtml}
  </div>
`;

export const createMailer = (props: { logger: Logger }) => {
  const { logger } = props;

  const transport = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });

  const sendOtpEmail = async (to: string, otp: string) => {
    const html = wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">Your login code</h2>
      <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; text-align: center;">Enter this code to sign in to UserCore.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 12px; color: #111827;">${otp}</div>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    `);

    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Your UserCore login code",
      html,
      text: `Your UserCore login code is: ${otp}\n\nThis code expires in 10 minutes.`,
    });

    logger.info({ msg: "OTP email sent", to });
  };

  const sendInvitationEmail = async (data: {
    to: string;
    workspaceName: string;
    inviterName: string;
    role: string;
  }) => {
    const loginUrl = "http://localhost:3000/login";

    const html = wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">You've been invited</h2>
      <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; text-align: center;">
        <strong>${data.inviterName}</strong> has invited you to join the <strong>${data.workspaceName}</strong> workspace on UserCore as a <strong>${data.role}</strong>.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #C0E1D2; color: #2f6048; font-weight: 600; text-decoration: none; border-radius: 12px;">Sign in to UserCore</a>
      </div>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">Sign in with this email address to accept the invitation. You'll receive a one-time code via email.</p>
    `);

    await transport.sendMail({
      from: env.SMTP_FROM,
      to: data.to,
      subject: `${data.inviterName} invited you to ${data.workspaceName} on UserCore`,
      html,
      text: `${data.inviterName} invited you to join the ${data.workspaceName} workspace on UserCore as a ${data.role}.\n\nSign in at ${loginUrl} with this email address to accept.`,
    });

    logger.info({ msg: "Invitation email sent", to: data.to });
  };

  return { sendOtpEmail, sendInvitationEmail };
};

export type Mailer = ReturnType<typeof createMailer>;
