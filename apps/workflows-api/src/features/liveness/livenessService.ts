import type { Logger } from "@usercore/logger";

import type { LivenessRepository } from "./livenessRepository";

export const createLivenessService = (props: {
  livenessRepository: LivenessRepository;
  logger: Logger;
}) => {
  const { livenessRepository, logger } = props;

  const saveLivenessResult = async (data: {
    kycSessionId: string;
    passed: boolean;
    confidence?: number;
    checks?: string[]; // e.g. ["blink_detected", "head_turn_left", "head_turn_right"]
  }) => {
    logger.info({
      msg: "Saving liveness result",
      sessionId: data.kycSessionId,
      passed: data.passed,
    });
    return livenessRepository.create({
      ...data,
      confidence: data.confidence?.toString(),
    });
  };

  const getLivenessResult = async (kycSessionId: string) => {
    return livenessRepository.findBySessionId(kycSessionId);
  };

  return { saveLivenessResult, getLivenessResult };
};

export type LivenessService = ReturnType<typeof createLivenessService>;
