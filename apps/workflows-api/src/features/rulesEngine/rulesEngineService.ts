import type { Logger } from "@usercore/logger";

import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { WorkflowsService } from "../workflows/workflowsService";
import type { RulesEngineRepository } from "./rulesEngineRepository";

// Rules-engine step is valid when at least one scenario from scenarios-api is
// linked to it.
export const createRulesEngineService = (props: {
  rulesEngineRepository: RulesEngineRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  workflowsService: WorkflowsService;
  logger: Logger;
}) => {
  const {
    rulesEngineRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  } = props;

  const addStep = async (data: { workflowId: string }) => {
    const existing = await workflowStepsRepository.findByWorkflowAndType(
      data.workflowId,
      "rules-engine",
    );
    if (existing) {
      logger.info({
        msg: "rules-engine step already exists",
        workflowId: data.workflowId,
      });
      return existing;
    }
    const workflowStep = await workflowStepsRepository.create({
      workflowId: data.workflowId,
      type: "rules-engine",
      provider: null,
      valid: false,
    });
    await rulesEngineRepository.createStep(workflowStep!.id);
    await workflowsService.recomputeValidity(data.workflowId);
    return workflowStep;
  };

  const getStep = async (workflowStepId: string) => {
    const step =
      await rulesEngineRepository.findStepByWorkflowStepId(workflowStepId);
    if (!step) return null;
    const scenarios = await rulesEngineRepository.listScenarios(step.id);
    return { step, scenarios };
  };

  const linkScenario = async (data: {
    workflowStepId: string;
    externalScenarioId: string;
  }) => {
    const step = await rulesEngineRepository.findStepByWorkflowStepId(
      data.workflowStepId,
    );
    if (!step) return null;
    const scenario = await rulesEngineRepository.linkScenario({
      rulesEngineStepId: step.id,
      externalScenarioId: data.externalScenarioId,
    });
    await _recomputeValidity(data.workflowStepId);
    return scenario;
  };

  const unlinkScenario = async (data: {
    workflowStepId: string;
    scenarioLinkId: string;
  }) => {
    await rulesEngineRepository.unlinkScenario(data.scenarioLinkId);
    await _recomputeValidity(data.workflowStepId);
  };

  const removeStep = async (workflowStepId: string) => {
    const step = await workflowStepsRepository.findById(workflowStepId);
    if (!step) return;
    await workflowStepsRepository.remove(workflowStepId);
    await workflowsService.recomputeValidity(step.workflowId);
  };

  const _recomputeValidity = async (workflowStepId: string) => {
    const step =
      await rulesEngineRepository.findStepByWorkflowStepId(workflowStepId);
    if (!step) return;
    const scenarios = await rulesEngineRepository.listScenarios(step.id);
    const valid = scenarios.length > 0;
    const updated = await workflowStepsRepository.update(workflowStepId, {
      valid,
    });
    if (updated) {
      await workflowsService.recomputeValidity(updated.workflowId);
    }
  };

  const listScenarioLinks = async (workspaceId: string) => {
    return rulesEngineRepository.findScenarioLinksByWorkspace(workspaceId);
  };

  return {
    addStep,
    getStep,
    linkScenario,
    unlinkScenario,
    removeStep,
    listScenarioLinks,
  };
};

export type RulesEngineService = ReturnType<typeof createRulesEngineService>;
