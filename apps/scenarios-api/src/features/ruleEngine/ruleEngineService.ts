import type { Logger } from "@usercore/logger";
import {
  findAttributeDefinition,
  normalizeCountryCode,
  type RuleOperator,
  type ScenarioCondition,
  type ScenarioEvaluation,
} from "@usercore/shared-types";

type CustomerData = Record<
  string,
  string | number | boolean | null | undefined
>;

export const createRuleEngineService = (props: { logger: Logger }) => {
  const { logger } = props;

  const evaluateCondition = (
    condition: ScenarioCondition,
    data: CustomerData,
  ): boolean => {
    const fieldValue = _resolveAttribute(condition.attribute, data);
    if (fieldValue === undefined || fieldValue === null) return false;

    // Country-valued attributes (nationality, issuing/residence country, IP
    // country) can be captured as alpha-2 ("AR", manual form/widget) or alpha-3
    // ("ARG", iDenfy / the scenario enum). Normalize BOTH sides to canonical
    // alpha-3 so the comparison matches regardless of source format. (Per
    // comma-separated part, to cover in/nin lists.)
    const isCountry =
      findAttributeDefinition(condition.attribute)?.valueDisplay === "country";
    const normalizeList = (v: string) =>
      isCountry
        ? v
            .split(",")
            .map((part) => normalizeCountryCode(part))
            .join(",")
        : v;
    const fieldStr = normalizeList(String(fieldValue));
    const ruleStr = normalizeList(condition.value);

    const strField = fieldStr.toLowerCase();
    const strRule = ruleStr.toLowerCase();
    const numField = Number(fieldValue);
    const numRule = Number(condition.value);

    return _applyOperator(condition.operator, {
      strField,
      strRule,
      numField,
      numRule,
      rawRuleValue: ruleStr,
    });
  };

  const evaluateGroup = (
    group: ScenarioEvaluation,
    data: CustomerData,
  ): boolean => {
    // Ignore incomplete conditions (no attribute) — a blank row left in the
    // editor must not silently break an AND/OR group.
    const conditionResults = group.queries
      .filter((q) => isRealCondition(q))
      .map((q) => evaluateCondition(q, data));
    const groupResults = group.queryGroups.map((g) => evaluateGroup(g, data));
    const all = [...conditionResults, ...groupResults];
    if (all.length === 0) return false;
    return group.operator === "AND" ? all.every(Boolean) : all.some(Boolean);
  };

  const evaluateScenario = (
    evaluation: ScenarioEvaluation,
    data: CustomerData,
  ): boolean => {
    const result = evaluateGroup(evaluation, data);
    logger.debug({
      msg: "Scenario evaluation",
      operator: evaluation.operator,
      queries: evaluation.queries.length,
      groups: evaluation.queryGroups.length,
      triggered: result,
    });
    return result;
  };

  return { evaluateCondition, evaluateGroup, evaluateScenario };
};

export type RuleEngineService = ReturnType<typeof createRuleEngineService>;

// A condition is only meaningful with an attribute to evaluate. Blank rows
// (saved by the editor) are ignored everywhere — evaluation and display.
export const isRealCondition = (c: ScenarioCondition): boolean =>
  (c.attribute ?? "").trim() !== "";

// Some attributes are derived from raw stored data — `identity_verification.age`
// is computed from `identity_verification.date_of_birth` so rules can match on
// age directly without the DB needing a separate column.
const _resolveAttribute = (
  attribute: string,
  data: CustomerData,
): string | number | boolean | null | undefined => {
  if (attribute === "identity_verification.age") {
    const dob = data["identity_verification.date_of_birth"];
    if (typeof dob !== "string" || dob.length === 0) return undefined;
    return _yearsBetween(dob, new Date());
  }
  return data[attribute];
};

// Whole-year diff. Accepts ISO date strings (YYYY-MM-DD or full ISO).
const _yearsBetween = (dobIso: string, now: Date): number | undefined => {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return undefined;
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    years--;
  }
  return years;
};

const _applyOperator = (
  operator: RuleOperator,
  ctx: {
    strField: string;
    strRule: string;
    numField: number;
    numRule: number;
    rawRuleValue: string;
  },
): boolean => {
  const { strField, strRule, numField, numRule, rawRuleValue } = ctx;
  switch (operator) {
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
    case "in": {
      // Set-intersection semantics: works for both single-valued (the customer
      // attribute is a scalar like "USA") and multi-valued (comma-separated
      // list like "sanction,pep") attributes.
      const customerVals = strField
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const ruleVals = rawRuleValue
        .toLowerCase()
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      return customerVals.some((c) => ruleVals.includes(c));
    }
    case "nin": {
      const customerVals = strField
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const ruleVals = rawRuleValue
        .toLowerCase()
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      return !customerVals.some((c) => ruleVals.includes(c));
    }
    case "contains":
      return strField.includes(strRule);
    default:
      return false;
  }
};
