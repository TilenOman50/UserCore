import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import type {
  ScenarioActionConfig,
  ScenarioEvaluation,
} from "@usercore/shared-types";
import { EVENTS } from "@usercore/shared-types";

import {
  isRealCondition,
  type RuleEngineService,
} from "../ruleEngine/ruleEngineService";
import type { ScenarioRepository } from "./scenarioRepository";

type CustomerData = Record<
  string,
  string | number | boolean | null | undefined
>;

export type TriggeredScenario = {
  scenarioId: string;
  name: string;
  actions: ScenarioActionConfig[];
};

export type EvaluatedCondition = {
  attribute: string;
  operator: string;
  value: string;
  passed: boolean;
};

export type EvaluatedScenario = {
  scenarioId: string;
  name: string;
  matched: boolean;
  actions: ScenarioActionConfig[];
  conditions: EvaluatedCondition[];
};

export const createScenarioService = (props: {
  scenarioRepository: ScenarioRepository;
  ruleEngineService: RuleEngineService;
  rabbitMQ: RabbitMQClient;
  logger: Logger;
}) => {
  const { scenarioRepository, ruleEngineService, rabbitMQ, logger } = props;

  const createScenario = async (data: {
    workspaceId: string;
    name: string;
    description?: string;
    createdBy?: string;
  }) => {
    logger.info({ msg: "Creating scenario", name: data.name });
    return scenarioRepository.create(data);
  };

  const getScenario = async (id: string) => {
    return scenarioRepository.findById(id);
  };

  const listScenarios = async (workspaceId: string) => {
    return scenarioRepository.findByWorkspaceId(workspaceId);
  };

  const updateScenario = async (
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      evaluation: ScenarioEvaluation;
      actions: ScenarioActionConfig[];
    }>,
  ) => {
    // Blank/in-progress condition rows are kept as-is (the editor needs them
    // while you build a scenario); they're simply ignored at evaluation and
    // display time via isRealCondition.
    return scenarioRepository.update(id, data);
  };

  const deleteScenario = async (id: string) => {
    return scenarioRepository.deleteById(id);
  };

  // Evaluate scenarios in a workspace against the customer's flattened
  // attribute map. When `scenarioIds` is given (the rules-engine step passes
  // only the scenarios linked to that workflow step) we evaluate just those;
  // otherwise the whole workspace. Returns the triggered scenarios + their
  // enabled actions so the caller (workflows-api) can derive a verdict, and
  // still publishes SCENARIO_TRIGGERED events for any downstream consumers.
  // Flatten a scenario's condition tree into a per-condition pass/fail list so
  // the reviewer can see WHY a scenario did or didn't match (the platform's
  // activity-log style).
  const flattenConditions = (
    group: ScenarioEvaluation,
    data: CustomerData,
  ): EvaluatedCondition[] => {
    const own = group.queries.filter(isRealCondition).map((q) => ({
      attribute: q.attribute,
      operator: q.operator,
      value: q.value,
      passed: ruleEngineService.evaluateCondition(q, data),
    }));
    const nested = group.queryGroups.flatMap((g) => flattenConditions(g, data));
    return [...own, ...nested];
  };

  const evaluateScenariosForCustomer = async (props: {
    workspaceId: string;
    customerId: string;
    customerData: CustomerData;
    scenarioIds?: string[];
  }): Promise<{
    triggered: TriggeredScenario[];
    evaluations: EvaluatedScenario[];
  }> => {
    const all = await scenarioRepository.findByWorkspaceId(props.workspaceId);
    const scenarios = props.scenarioIds
      ? all.filter((s) => props.scenarioIds!.includes(s.id))
      : all;

    const triggered: TriggeredScenario[] = [];
    const evaluations: EvaluatedScenario[] = [];
    for (const scenario of scenarios) {
      const matched = ruleEngineService.evaluateScenario(
        scenario.evaluation,
        props.customerData,
      );
      const actions = scenario.actions.filter((a) => a.enabled);
      evaluations.push({
        scenarioId: scenario.id,
        name: scenario.name,
        matched,
        actions: matched ? actions : [],
        conditions: flattenConditions(scenario.evaluation, props.customerData),
      });
      if (!matched) continue;
      triggered.push({ scenarioId: scenario.id, name: scenario.name, actions });
      for (const action of actions) {
        await rabbitMQ.publish({
          exchange: "usercore.events",
          routingKey: EVENTS.SCENARIO_TRIGGERED,
          payload: {
            scenarioId: scenario.id,
            customerId: props.customerId,
            workspaceId: props.workspaceId,
            actionType: action.type,
            actionValue: action.value,
          },
        });
        logger.info({
          msg: "Scenario triggered",
          scenarioId: scenario.id,
          action: action.type,
        });
      }
    }
    return { triggered, evaluations };
  };

  return {
    createScenario,
    getScenario,
    listScenarios,
    updateScenario,
    deleteScenario,
    evaluateScenariosForCustomer,
  };
};

export type ScenarioService = ReturnType<typeof createScenarioService>;
