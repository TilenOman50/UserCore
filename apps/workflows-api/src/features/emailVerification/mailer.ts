import { createTransport } from "nodemailer";

import type { Logger } from "@usercore/logger";

import { env } from "../../env";

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

  const sendVerificationOtp = async (to: string, otp: string) => {
    const html = wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827; text-align: center;">Verify your email</h2>
      <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; text-align: center;">Enter this code in the verification flow.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 12px; color: #111827;">${otp}</div>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">This code expires in 10 minutes.</p>
    `);
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Your UserCore verification code",
      html,
      text: `Your UserCore verification code is: ${otp}\n\nIt expires in 10 minutes.`,
    });
    logger.info({ msg: "Verification OTP sent", to });
  };

  return { sendVerificationOtp };
};

export type Mailer = ReturnType<typeof createMailer>;
