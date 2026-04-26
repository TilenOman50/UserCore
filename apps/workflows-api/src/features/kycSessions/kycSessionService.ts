import { HTTPException } from "hono/http-exception";

import type { Logger } from "@usercore/logger";

import type { KycSessionRepository } from "./kycSessionRepository";

export const createKycSessionService = (props: {
  kycSessionRepository: KycSessionRepository;
  logger: Logger;
}) => {
  const { kycSessionRepository, logger } = props;

  const startSession = async (data: {
    customerId: string;
    workspaceId: string;
  }) => {
    const existing = await kycSessionRepository.findByCustomerId(
      data.customerId,
    );
    if (existing && !["rejected"].includes(existing.status)) {
      return existing;
    }
    logger.info({ msg: "Starting KYC session", customerId: data.customerId });
    return kycSessionRepository.create(data);
  };

  const getSession = async (id: string) => {
    const session = await kycSessionRepository.findById(id);
    if (!session) {
      throw new HTTPException(404, { message: "KYC session not found" });
    }
    return session;
  };

  const listByWorkspace = async (workspaceId: string) => {
    return kycSessionRepository.findByWorkspaceId(workspaceId);
  };

  const submitFormData = async (
    id: string,
    data: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      nationality: string;
      address: string;
      city: string;
      country: string;
    },
  ) => {
    logger.info({ msg: "Submitting form data", sessionId: id });
    return kycSessionRepository.updateFormData(id, {
      ...data,
      status: "form_completed",
    });
  };

  const submitSession = async (id: string) => {
    logger.info({ msg: "Submitting KYC session", sessionId: id });
    return kycSessionRepository.updateStatus(id, "submitted");
  };

  const markUnderReview = async (id: string) => {
    return kycSessionRepository.updateStatus(id, "under_review");
  };

  return {
    startSession,
    getSession,
    listByWorkspace,
    submitFormData,
    submitSession,
    markUnderReview,
  };
};

export type KycSessionService = ReturnType<typeof createKycSessionService>;
