import type { Logger } from "@usercore/logger";

import type { StorageService } from "../../storage/storageService";
import type { WorkflowsRepository } from "../workflows/workflowsRepository";
import type { WorkflowSessionAttributesRepository } from "../workflowSessions/workflowSessionAttributesRepository";
import type { WorkflowSessionsRepository } from "../workflowSessions/workflowSessionsRepository";
import type { Mailer } from "./mailer";

const DEFAULT_BRAND_NAME = "UserCore Verification";
const DEFAULT_PRIMARY_COLOR = "#C0E1D2";

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
  sessionsRepository: WorkflowSessionsRepository;
  workflowsRepository: WorkflowsRepository;
  storageService: StorageService;
  mailer: Mailer;
  logger: Logger;
}) => {
  const {
    attributesRepository,
    sessionsRepository,
    workflowsRepository,
    storageService,
    mailer,
    logger,
  } = props;

  const sendCode = async (data: {
    workflowSessionId: string;
    email: string;
    locale: string | null;
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

    // Resolve the workflow's brand so the email arrives looking like it came
    // from the host the customer recognises (NLB, HSBC, …), not "UserCore".
    // An elderly customer mid-onboarding sees an English UserCore email and
    // dismisses it as phishing — branded subject + sender + body fixes that.
    const session = await sessionsRepository.findById(data.workflowSessionId);
    const workflow = session
      ? await workflowsRepository.findById(session.workflowId)
      : null;
    const branding = workflow?.branding ?? {};
    const brandName =
      branding.brandName?.trim() && branding.brandName.trim().length > 0
        ? branding.brandName.trim()
        : DEFAULT_BRAND_NAME;
    const primaryColor = branding.primaryColor ?? DEFAULT_PRIMARY_COLOR;
    const senderEmail =
      branding.senderEmail && branding.senderEmail.trim().length > 0
        ? branding.senderEmail.trim()
        : null;

    // Fetch logo bytes so we can inline them as a CID attachment — email
    // clients render those directly from the message, no public URL needed.
    // Best-effort: if MinIO is down or the key is stale, send without logo.
    let logo: { body: Buffer; contentType: string } | null = null;
    if (branding.logoS3Key) {
      try {
        const obj = await storageService.getObject(branding.logoS3Key);
        if (obj) {
          logo = {
            body: Buffer.from(obj.body),
            contentType: obj.contentType,
          };
        }
      } catch (err) {
        logger.warn({
          msg: "Failed to fetch brand logo for email; falling back to initials",
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await mailer.sendVerificationOtp({
      to: data.email,
      otp,
      brandName,
      primaryColor,
      logo,
      senderEmail,
      locale: data.locale,
    });
    logger.info({
      msg: "Email OTP sent",
      sessionId: data.workflowSessionId,
      brand: brandName,
      locale: data.locale,
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
