import type { Logger } from "@usercore/logger";

import type { ScenarioRule } from "../../db/schema.db";

type UserData = Record<string, string | number | boolean | null | undefined>;

/**
 * Simple rule engine — evaluates scenario rules against user profile data.
 * Supports: eq, neq, gt, lt, gte, lte, in, contains operators.
 */
export const createRuleEngineService = (props: { logger: Logger }) => {
  const { logger } = props;

  const evaluateRule = (rule: ScenarioRule, userData: UserData): boolean => {
    const fieldValue = userData[rule.field];
    const ruleValue = rule.value;

    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const strField = String(fieldValue).toLowerCase();
    const strRule = ruleValue.toLowerCase();
    const numField = Number(fieldValue);
    const numRule = Number(ruleValue);

    switch (rule.operator) {
      case "eq":
        return strField === strRule;
      case "neq":
        return strField !== strRule;
      case "gt":
        return !isNaN(numField) && !isNaN(numRule) && numField > numRule;
      case "lt":
        return !isNaN(numField) && !isNaN(numRule) && numField < numRule;
      case "gte":
        return !isNaN(numField) && !isNaN(numRule) && numField >= numRule;
      case "lte":
        return !isNaN(numField) && !isNaN(numRule) && numField <= numRule;
      case "in":
        // ruleValue is comma-separated list: "US,CA,GB"
        return ruleValue.split(",").map(v => v.trim().toLowerCase()).includes(strField);
      case "contains":
        return strField.includes(strRule);
      default:
        return false;
    }
  };

  const evaluateScenario = (
    rules: ScenarioRule[],
    userData: UserData,
  ): boolean => {
    // All rules must pass (AND logic)
    const result = rules.every(rule => evaluateRule(rule, userData));
    logger.debug({
      msg: "Scenario evaluation",
      ruleCount: rules.length,
      triggered: result,
    });
    return result;
  };

  return { evaluateRule, evaluateScenario };
};

export type RuleEngineService = ReturnType<typeof createRuleEngineService>;
