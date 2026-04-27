import type { Logger } from "@usercore/logger";

import type { WorkflowsService } from "../workflows/workflowsService";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { DuplicateDetectionRepository } from "./duplicateDetectionRepository";

// Duplicate detection runs locally against existing customer profiles in the
// workspace. No provider, always valid once added.
export const createDuplicateDetectionService = (props: {
  duplicateDetectionRepository: DuplicateDetectionRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  workflowsService: WorkflowsService;
  logger: Logger;
}) => {
  const {
    duplicateDetectionRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  } = props;

  const addStep = async (data: { workflowId: string }) => {
    const existing = await workflowStepsRepository.findByWorkflowAndType(
      data.workflowId,
      "duplicate-detection",
    );
    if (existing) {
      logger.info({
        msg: "duplicate-detection step already exists",
        workflowId: data.workflowId,
      });
      return existing;
    }
    const workflowStep = await workflowStepsRepository.create({
      workflowId: data.workflowId,
      type: "duplicate-detection",
      provider: null,
      valid: true,
    });
    await duplicateDetectionRepository.create(workflowStep!.id);
    await workflowsService.recomputeValidity(data.workflowId);
    return workflowStep;
  };

  const getStep = async (workflowStepId: string) => {
    return duplicateDetectionRepository.findByWorkflowStepId(workflowStepId);
  };

  const removeStep = async (workflowStepId: string) => {
    const step = await workflowStepsRepository.findById(workflowStepId);
    if (!step) return;
    await workflowStepsRepository.remove(workflowStepId);
    await workflowsService.recomputeValidity(step.workflowId);
  };

  return { addStep, getStep, removeStep };
};

export type DuplicateDetectionService = ReturnType<
  typeof createDuplicateDetectionService
>;
