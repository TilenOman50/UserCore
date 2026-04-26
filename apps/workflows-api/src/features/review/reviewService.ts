import { HTTPException } from "hono/http-exception";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { EVENTS } from "@usercore/shared-types";

import type { KycSessionService } from "../kycSessions/kycSessionService";
import type { ReviewRepository } from "./reviewRepository";

export const createReviewService = (props: {
  reviewRepository: ReviewRepository;
  kycSessionService: KycSessionService;
  rabbitMQ: RabbitMQClient;
  logger: Logger;
}) => {
  const { reviewRepository, kycSessionService, rabbitMQ, logger } = props;

  const submitReview = async (data: {
    kycSessionId: string;
    reviewedBy: string;
    decision: "approved" | "rejected";
    reason?: string;
  }) => {
    const session = await kycSessionService.getSession(data.kycSessionId);

    if (!["submitted", "under_review"].includes(session.status)) {
      throw new HTTPException(400, {
        message: "Session is not in a reviewable state",
      });
    }

    const review = await reviewRepository.create(data);

    // Update session status
    await kycSessionService.markUnderReview(data.kycSessionId);

    // Publish KYC completed event
    await rabbitMQ.publish({
      exchange: "usercore.events",
      routingKey: EVENTS.KYC_COMPLETED,
      payload: {
        kycSessionId: data.kycSessionId,
        customerId: session.customerId,
        workspaceId: session.workspaceId,
        status: data.decision === "approved" ? "approved" : "rejected",
        reviewedAt: new Date().toISOString(),
        reviewedBy: data.reviewedBy,
        reason: data.reason,
      },
    });

    logger.info({
      msg: "KYC review submitted",
      sessionId: data.kycSessionId,
      decision: data.decision,
    });

    return review;
  };

  const getReview = async (kycSessionId: string) => {
    return reviewRepository.findBySessionId(kycSessionId);
  };

  return { submitReview, getReview };
};

export type ReviewService = ReturnType<typeof createReviewService>;
