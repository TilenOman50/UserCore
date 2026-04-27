import type { Logger } from "@usercore/logger";
import type { ProviderShortName } from "@usercore/shared-types";

import type { WorkflowsService } from "../workflows/workflowsService";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { AmlScreeningRepository } from "./amlScreeningRepository";

// AML screening only makes sense behind a provider — there's no in-house
// sanctions/PEP database. valid = (provider != null).
export const createAmlScreeningService = (props: {
  amlScreeningRepository: AmlScreeningRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  workflowsService: WorkflowsService;
  logger: Logger;
}) => {
  const {
    amlScreeningRepository,
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
      "aml-screening",
    );
    if (existing) {
      logger.info({
        msg: "aml-screening step already exists",
        workflowId: data.workflowId,
      });
      return existing;
    }
    const provider = data.provider ?? null;
    const workflowStep = await workflowStepsRepository.create({
      workflowId: data.workflowId,
      type: "aml-screening",
      provider,
      valid: provider !== null,
    });
    await amlScreeningRepository.create({ workflowStepId: workflowStep!.id });
    await workflowsService.recomputeValidity(data.workflowId);
    return workflowStep;
  };

  const getStep = async (workflowStepId: string) => {
    return amlScreeningRepository.findByWorkflowStepId(workflowStepId);
  };

  const updateStep = async (
    workflowStepId: string,
    data: Partial<{
      screenOnCreated: boolean;
      monitorOngoing: boolean;
      providerConfig: unknown;
    }>,
  ) => {
    return amlScreeningRepository.update(workflowStepId, data);
  };

  const setProvider = async (data: {
    workflowStepId: string;
    provider: ProviderShortName | null;
  }) => {
    const updated = await workflowStepsRepository.update(data.workflowStepId, {
      provider: data.provider,
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

export type AmlScreeningService = ReturnType<typeof createAmlScreeningService>;
