import type { Logger } from "@usercore/logger";
import type {
  WorkflowReason,
  WorkflowStatus,
  WorkflowType,
  WorkflowVerificationMode,
} from "@usercore/shared-types";

import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { WorkflowsRepository } from "./workflowsRepository";

export const createWorkflowsService = (props: {
  workflowsRepository: WorkflowsRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  logger: Logger;
}) => {
  const { workflowsRepository, workflowStepsRepository, logger } = props;

  const createWorkflow = async (data: {
    workspaceId: string;
    organizationId: string;
    displayName: string;
    type?: WorkflowType;
    status?: WorkflowStatus;
    verificationMode?: WorkflowVerificationMode;
    isDefault?: boolean;
  }) => {
    logger.info({
      msg: "Creating workflow",
      workspaceId: data.workspaceId,
      displayName: data.displayName,
    });
    return workflowsRepository.create(data);
  };

  const getWorkflow = async (id: string) => {
    return workflowsRepository.findByIdWithSteps(id);
  };

  const listByWorkspace = async (
    workspaceId: string,
    organizationId: string,
  ) => {
    return workflowsRepository.findByWorkspace(workspaceId, organizationId);
  };

  const listByWorkspacePaginated = async (data: {
    workspaceId: string;
    organizationId: string;
    page: number;
    limit: number;
  }) => {
    return workflowsRepository.findByWorkspacePaginated(data);
  };

  const getDefault = async (workspaceId: string, type: WorkflowType) => {
    return workflowsRepository.findDefaultByWorkspace(workspaceId, type);
  };

  const updateWorkflow = async (
    id: string,
    data: Partial<{
      displayName: string;
      description: string | null;
      status: WorkflowStatus;
      verificationMode: WorkflowVerificationMode;
      isDefault: boolean;
    }>,
  ) => {
    logger.info({ msg: "Updating workflow", workflowId: id });
    return workflowsRepository.update(id, data);
  };

  const deleteWorkflow = async (id: string) => {
    logger.info({ msg: "Deleting workflow", workflowId: id });
    await workflowsRepository.remove(id);
  };

  // Recompute aggregate workflow validity from its child steps. Called after
  // any step-level mutation (step add/remove, sub-step toggle, provider change).
  const recomputeValidity = async (workflowId: string) => {
    const steps = await workflowStepsRepository.findByWorkflowId(workflowId);
    const reasons: WorkflowReason[] = [];

    if (steps.length === 0) {
      reasons.push({ message: "Workflow has no steps" });
    }

    for (const step of steps) {
      if (!step.valid) {
        reasons.push({
          stepType: step.type,
          message: `Step '${step.type}' is not valid`,
        });
      }
    }

    const valid = reasons.length === 0;
    return workflowsRepository.updateValidity(workflowId, valid, reasons);
  };

  return {
    createWorkflow,
    getWorkflow,
    listByWorkspace,
    listByWorkspacePaginated,
    getDefault,
    updateWorkflow,
    deleteWorkflow,
    recomputeValidity,
  };
};

export type WorkflowsService = ReturnType<typeof createWorkflowsService>;
