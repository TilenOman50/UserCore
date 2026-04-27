import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import type {
  ScenarioActionConfig,
  ScenarioEvaluation,
} from "@usercore/shared-types";
import { EVENTS } from "@usercore/shared-types";

import type { RuleEngineService } from "../ruleEngine/ruleEngineService";
import type { ScenarioRepository } from "./scenarioRepository";

type CustomerData = Record<
  string,
  string | number | boolean | null | undefined
>;

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
    return scenarioRepository.update(id, data);
  };

  const deleteScenario = async (id: string) => {
    return scenarioRepository.deleteById(id);
  };

  // Run every scenario in a workspace against the customer's flattened
  // attribute map. workflows-api's rules-engine step already passes only the
  // scenarios linked to a specific workflow step when calling /evaluate, so
  // we don't need a separate "active" flag.
  const evaluateScenariosForCustomer = async (props: {
    workspaceId: string;
    customerId: string;
    customerData: CustomerData;
  }) => {
    const scenarios = await scenarioRepository.findByWorkspaceId(
      props.workspaceId,
    );
    for (const scenario of scenarios) {
      const triggered = ruleEngineService.evaluateScenario(
        scenario.evaluation,
        props.customerData,
      );
      if (!triggered) continue;
      for (const action of scenario.actions) {
        if (!action.enabled) continue;
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
