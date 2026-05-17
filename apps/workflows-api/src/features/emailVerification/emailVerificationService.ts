import type { Logger } from "@usercore/logger";

import type { WorkflowSessionAttributesRepository } from "../workflowSessions/workflowSessionAttributesRepository";
import type { Mailer } from "./mailer";

// 6-digit numeric code, padded so the first digit can be a zero.
const generateOtp = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const OTP_TTL_MS = 10 * 60 * 1000;

export class EmailVerificationError extends Error {
  constructor(
    public readonly code:
      | "no_otp_pending"
      | "otp_expired"
      | "email_mismatch"
      | "code_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "EmailVerificationError";
  }
}

export const createEmailVerificationService = (props: {
  attributesRepository: WorkflowSessionAttributesRepository;
  mailer: Mailer;
  logger: Logger;
}) => {
  const { attributesRepository, mailer, logger } = props;

  const sendCode = async (data: {
    workflowSessionId: string;
    email: string;
  }) => {
    const otp = generateOtp();
    await attributesRepository.batchUpsert({
      workflowSessionId: data.workflowSessionId,
      attributes: [
        {
          attribute: "_email_otp.code",
          value: otp,
          attributeType: "STRING",
        },
        {
          attribute: "_email_otp.email",
          value: data.email,
          attributeType: "STRING",
        },
        {
          attribute: "_email_otp.sent_at",
          value: new Date().toISOString(),
          attributeType: "DATE",
        },
      ],
    });
    await mailer.sendVerificationOtp(data.email, otp);
    logger.info({
      msg: "Email OTP sent",
      sessionId: data.workflowSessionId,
    });
  };

  const verifyCode = async (data: {
    workflowSessionId: string;
    email: string;
    code: string;
  }) => {
    const attrs = await attributesRepository.findBySessionId(
      data.workflowSessionId,
    );
    const find = (name: string) =>
      attrs.find((a) => a.attribute === name)?.value;
    const storedCode = find("_email_otp.code");
    const storedEmail = find("_email_otp.email");
    const sentAt = find("_email_otp.sent_at");

    if (!storedCode || !storedEmail || !sentAt) {
      throw new EmailVerificationError(
        "no_otp_pending",
        "Request a new code first.",
      );
    }
    if (Date.now() - new Date(sentAt).getTime() > OTP_TTL_MS) {
      throw new EmailVerificationError(
        "otp_expired",
        "Code expired. Request a new one.",
      );
    }
    if (storedEmail !== data.email) {
      throw new EmailVerificationError(
        "email_mismatch",
        "Email does not match the one the code was sent to.",
      );
    }
    if (storedCode !== data.code) {
      throw new EmailVerificationError("code_mismatch", "Incorrect code.");
    }

    // Persist the real completion attribute. The widget's overview keys off
    // `email_verification.email` to mark the step done.
    await attributesRepository.batchUpsert({
      workflowSessionId: data.workflowSessionId,
      attributes: [
        {
          attribute: "email_verification.email",
          value: data.email,
          attributeType: "STRING",
        },
        {
          attribute: "email_verification.verified_at",
          value: new Date().toISOString(),
          attributeType: "DATE",
        },
      ],
    });
    logger.info({
      msg: "Email OTP verified",
      sessionId: data.workflowSessionId,
    });
  };

  return { sendCode, verifyCode };
};

export type EmailVerificationService = ReturnType<
  typeof createEmailVerificationService
>;
