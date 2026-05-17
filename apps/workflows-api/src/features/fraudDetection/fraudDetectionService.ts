import type { Logger } from "@usercore/logger";
import type {
  ProviderCredentialMode,
  ProviderShortName,
} from "@usercore/shared-types";

import type { WorkflowsService } from "../workflows/workflowsService";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { FraudDetectionRepository } from "./fraudDetectionRepository";

// Fraud detection requires a provider (IP intelligence, device fingerprinting,
// etc.). valid = (provider != null).
export const createFraudDetectionService = (props: {
  fraudDetectionRepository: FraudDetectionRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  workflowsService: WorkflowsService;
  logger: Logger;
}) => {
  const {
    fraudDetectionRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  } = props;

  const addStep = async (data: {
    workflowId: string;
    provider?: ProviderShortName | null;
  }) => {
    const existing = await workflowStepsRepository.findByWorkflowAndType(
      data.workflowId,
      "fraud-detection",
    );
    if (existing) {
      logger.info({
        msg: "fraud-detection step already exists",
        workflowId: data.workflowId,
      });
      return existing;
    }
    const provider = data.provider ?? null;
    const workflowStep = await workflowStepsRepository.create({
      workflowId: data.workflowId,
      type: "fraud-detection",
      provider,
      valid: provider !== null,
    });
    await fraudDetectionRepository.create({ workflowStepId: workflowStep!.id });
    await workflowsService.recomputeValidity(data.workflowId);
    return workflowStep;
  };

  const getStep = async (workflowStepId: string) => {
    return fraudDetectionRepository.findByWorkflowStepId(workflowStepId);
  };

  const updateStep = async (
    workflowStepId: string,
    data: Partial<{
      screenOnCreated: boolean;
      providerConfig: unknown;
    }>,
  ) => {
    return fraudDetectionRepository.update(workflowStepId, data);
  };

  const setProvider = async (data: {
    workflowStepId: string;
    provider: ProviderShortName | null;
    providerCredentialMode?: ProviderCredentialMode;
  }) => {
    const updated = await workflowStepsRepository.update(data.workflowStepId, {
      provider: data.provider,
      providerCredentialMode: data.providerCredentialMode ?? "managed",
      valid: data.provider !== null,
    });
    if (updated) {
      await workflowsService.recomputeValidity(updated.workflowId);
    }
    return updated;
  };

  const removeStep = async (workflowStepId: string) => {
    const step = await workflowStepsRepository.findById(workflowStepId);
    if (!step) return;
    await workflowStepsRepository.remove(workflowStepId);
    await workflowsService.recomputeValidity(step.workflowId);
  };

  return { addStep, getStep, updateStep, setProvider, removeStep };
};

export type FraudDetectionService = ReturnType<
  typeof createFraudDetectionService
>;
