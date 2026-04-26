import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { EVENTS } from "@usercore/shared-types";

import type {
  ScenarioActionTable,
  ScenarioRuleTable,
} from "../../db/schema.db";
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
    data: { name?: string; description?: string; isActive?: boolean },
  ) => {
    return scenarioRepository.update(id, {
      ...data,
      isActive: data.isActive !== undefined ? String(data.isActive) : undefined,
    });
  };

  const deleteScenario = async (id: string) => {
    return scenarioRepository.deleteById(id);
  };

  const addRule = async (data: {
    scenarioId: string;
    field: string;
    operator: typeof ScenarioRuleTable.$inferInsert.operator;
    value: string;
  }) => {
    return scenarioRepository.createRule(data);
  };

  const removeRule = async (ruleId: string) => {
    return scenarioRepository.deleteRule(ruleId);
  };

  const addAction = async (data: {
    scenarioId: string;
    actionType: typeof ScenarioActionTable.$inferInsert.actionType;
    config?: Record<string, unknown>;
  }) => {
    return scenarioRepository.createAction(data);
  };

  /**
   * Evaluate all active scenarios for a workspace against the given customer data.
   * Triggered when a KYC session is submitted or a profile is updated.
   */
  const evaluateScenariosForCustomer = async (props: {
    workspaceId: string;
    customerId: string;
    customerData: CustomerData;
  }) => {
    const scenarios = await scenarioRepository.findActiveByWorkspaceId(
      props.workspaceId,
    );

    for (const scenario of scenarios) {
      if (scenario.isActive !== "true") continue;

      const rules = await scenarioRepository.findRulesByScenarioId(scenario.id);
      const triggered = ruleEngineService.evaluateScenario(
        rules,
        props.customerData,
      );

      if (triggered) {
        const actions = await scenarioRepository.findActionsByScenarioId(
          scenario.id,
        );

        for (const action of actions) {
          await rabbitMQ.publish({
            exchange: "usercore.events",
            routingKey: EVENTS.SCENARIO_TRIGGERED,
            payload: {
              scenarioId: scenario.id,
              customerId: props.customerId,
              workspaceId: props.workspaceId,
              actionType: action.actionType,
            },
          });
          logger.info({
            msg: "Scenario triggered",
            scenarioId: scenario.id,
            action: action.actionType,
          });
        }
      }
    }
  };

  return {
    createScenario,
    getScenario,
    listScenarios,
    updateScenario,
    deleteScenario,
    addRule,
    removeRule,
    addAction,
    evaluateScenariosForCustomer,
  };
};

export type ScenarioService = ReturnType<typeof createScenarioService>;
