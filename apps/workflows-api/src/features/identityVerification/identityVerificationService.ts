import type { Logger } from "@usercore/logger";
import type { ProviderShortName } from "@usercore/shared-types";

import type { WorkflowsService } from "../workflows/workflowsService";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { IdentityVerificationRepository } from "./identityVerificationRepository";

export const createIdentityVerificationService = (props: {
  identityVerificationRepository: IdentityVerificationRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  workflowsService: WorkflowsService;
  logger: Logger;
}) => {
  const {
    identityVerificationRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  } = props;

  // Add the identity-verification step to a workflow. Creates the workflow_step
  // row, the identity_verification_step row, and pre-seeds all sub-step rows
  // with enabled=false. Idempotent on (workflowId, type).
  const addStep = async (data: {
    workflowId: string;
    provider?: ProviderShortName | null;
  }) => {
    const existing = await workflowStepsRepository.findByWorkflowAndType(
      data.workflowId,
      "identity-verification",
    );
    if (existing) {
      logger.info({
        msg: "identity-verification step already exists",
        workflowId: data.workflowId,
      });
      return existing;
    }

    const workflowStep = await workflowStepsRepository.create({
      workflowId: data.workflowId,
      type: "identity-verification",
      provider: data.provider ?? null,
      valid: false,
    });
    await identityVerificationRepository.createStepWithSubSteps(
      workflowStep!.id,
    );
    await workflowsService.recomputeValidity(data.workflowId);
    return workflowStep;
  };

  const getStep = async (workflowStepId: string) => {
    const step =
      await identityVerificationRepository.findByWorkflowStepId(workflowStepId);
    if (!step) return null;
    const subSteps = await identityVerificationRepository.findSubStepsByStepId(
      step.id,
    );
    return { step, subSteps };
  };

  const setProvider = async (data: {
    workflowStepId: string;
    provider: ProviderShortName | null;
  }) => {
    const updated = await workflowStepsRepository.update(data.workflowStepId, {
      provider: data.provider,
    });
    if (updated) {
      await workflowsService.recomputeValidity(updated.workflowId);
    }
    return updated;
  };

  const toggleSubStep = async (data: {
    subStepId: string;
    enabled: boolean;
  }) => {
    const subStep = await identityVerificationRepository.findSubStepById(
      data.subStepId,
    );
    if (!subStep) return null;
    // terms-acceptance is required for every flow; the dashboard hides the
    // toggle but reject API-level attempts too so the widget can always rely
    // on it being enabled.
    if (subStep.type === "terms-acceptance") return subStep;
    // valid mirrors enabled — no extra config required for these sub-steps in
    // the current scope; revisit when per-sub-step provider tuning lands.
    const updated = await identityVerificationRepository.updateSubStep(
      data.subStepId,
      { enabled: data.enabled, valid: data.enabled },
    );
    await _recomputeStepValidity(subStep.identityVerificationStepId);
    return updated;
  };

  const updateSubStepConfig = async (data: {
    subStepId: string;
    providerConfig: unknown;
  }) => {
    return identityVerificationRepository.updateSubStep(data.subStepId, {
      providerConfig: data.providerConfig,
    });
  };

  const removeStep = async (workflowStepId: string) => {
    const step = await workflowStepsRepository.findById(workflowStepId);
    if (!step) return;
    await workflowStepsRepository.remove(workflowStepId);
    await workflowsService.recomputeValidity(step.workflowId);
  };

  // The identity-verification step is valid when at least one sub-step is
  // enabled and all enabled sub-steps are valid.
  const _recomputeStepValidity = async (identityVerificationStepId: string) => {
    const ivStep = await identityVerificationRepository.findById(
      identityVerificationStepId,
    );
    if (!ivStep) return;

    const subSteps = await identityVerificationRepository.findSubStepsByStepId(
      identityVerificationStepId,
    );
    const enabledSubSteps = subSteps.filter((s) => s.enabled);
    // terms-acceptance is always enabled; we still need at least one real
    // verification sub-step before considering the step configured.
    const hasRealSubStep = enabledSubSteps.some(
      (s) => s.type !== "terms-acceptance",
    );
    const valid = hasRealSubStep && enabledSubSteps.every((s) => s.valid);

    await workflowStepsRepository.update(ivStep.workflowStepId, { valid });
    const workflowStep = await workflowStepsRepository.findById(
      ivStep.workflowStepId,
    );
    if (workflowStep) {
      await workflowsService.recomputeValidity(workflowStep.workflowId);
    }
  };

  return {
    addStep,
    getStep,
    setProvider,
    toggleSubStep,
    updateSubStepConfig,
    removeStep,
  };
};

export type IdentityVerificationService = ReturnType<
  typeof createIdentityVerificationService
>;
