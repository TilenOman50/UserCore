import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertOctagon,
  ArrowLeft,
  ChevronRight,
  Flag,
  FolderTree,
  Plus,
  TagIcon,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  COUNTRY_NAME_BY_CODE,
  CUSTOMER_RISK_LEVELS,
  CUSTOMER_STATUS_VALUES,
  emptyEvaluation,
  OPERATORS_BY_ATTRIBUTE_TYPE,
  SCENARIO_ATTRIBUTES,
  type AttributeDefinition,
  type CustomerRiskLevel,
  type CustomerStatus,
  type IsoCountryCode,
  type RuleOperator,
  type ScenarioActionConfig,
  type ScenarioActionType,
  type ScenarioCondition,
  type ScenarioEvaluation,
} from "@usercore/shared-types";

import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  AttributePickerModal,
  TYPE_BADGE_COLORS,
} from "../components/scenarios/AttributePickerModal";
import { MultiSelect } from "../components/ui/MultiSelect";
import { SaveIndicator } from "../components/ui/SaveIndicator";
import { Select } from "../components/ui/Select";
import { READ_ONLY_HINT, useCanManageConfig } from "../lib/hooks/usePlan";
import {
  useDeleteScenario,
  useScenario,
  useScenarioLinks,
  useUpdateScenario,
} from "../lib/hooks/useScenarios";
import { useWorkspace } from "../lib/workspaceContext";

type IconComp = ComponentType<{ size?: number; className?: string }>;

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: "is equal to",
  neq: "is not equal to",
  gt: "is greater than",
  gte: "is greater than or equal to",
  lt: "is less than",
  lte: "is less than or equal to",
  in: "is one of",
  nin: "is not one of",
  contains: "contains",
};

const ACTION_LABELS: Record<ScenarioActionType, string> = {
  set_customer_status: "Set customer status",
  set_customer_risk_level: "Set customer risk level",
  assign_tag: "Assign tag(s)",
};

const ACTION_DESCRIPTIONS: Record<ScenarioActionType, string> = {
  set_customer_status:
    "Update the customer's account status (approved, rejected, flagged…).",
  set_customer_risk_level:
    "Set a risk level on the customer's profile for downstream filtering.",
  assign_tag:
    "Attach one or more tags to the customer for grouping or routing.",
};

const ACTION_ICONS: Record<ScenarioActionType, IconComp> = {
  set_customer_status: Flag,
  set_customer_risk_level: AlertOctagon,
  assign_tag: TagIcon,
};

export const ScenarioDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scenarioId = id ?? null;
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";

  const scenarioQuery = useScenario(scenarioId);
  const linksQuery = useScenarioLinks(workspaceId);
  const update = useUpdateScenario();
  const remove = useDeleteScenario();
  const canEdit = useCanManageConfig();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [evaluation, setEvaluation] =
    useState<ScenarioEvaluation>(emptyEvaluation());
  const [actions, setActions] = useState<ScenarioActionConfig[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Hydrate local state from server.
  useEffect(() => {
    if (!scenarioQuery.data) return;
    setName(scenarioQuery.data.name);
    setDescription(scenarioQuery.data.description ?? "");
    setEvaluation(scenarioQuery.data.evaluation);
    setActions(scenarioQuery.data.actions);
  }, [scenarioQuery.data]);

  // Auto-save: when local state diverges from server, persist after a short
  // debounce so rapid edits collapse into one PATCH and dropdown picks save
  // almost instantly. Members can't edit so the effect is a no-op.
  useEffect(() => {
    if (!canEdit) return;
    const server = scenarioQuery.data;
    if (!server) return;
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const dirty =
      // Name must always have a value; treat blank as "not yet dirty" so we
      // don't overwrite a real name with an empty one mid-edit.
      (trimmedName.length > 0 && trimmedName !== server.name) ||
      trimmedDescription !== (server.description ?? "") ||
      JSON.stringify(server.evaluation) !== JSON.stringify(evaluation) ||
      JSON.stringify(server.actions) !== JSON.stringify(actions);
    if (!dirty) return;
    const t = setTimeout(() => {
      update.mutate({
        scenarioId: server.id,
        patch: {
          name: trimmedName.length > 0 ? trimmedName : undefined,
          description:
            trimmedDescription.length > 0 ? trimmedDescription : null,
          evaluation,
          actions,
        },
      });
    }, 500);
    return () => clearTimeout(t);
    // update.mutate is stable from react-query; we don't depend on it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, evaluation, actions, scenarioQuery.data, canEdit]);

  if (scenarioQuery.isLoading || !scenarioQuery.data) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-sm text-gray-500">
          {scenarioQuery.isLoading
            ? "Loading scenario…"
            : "Scenario not found."}
        </div>
      </div>
    );
  }

  const s = scenarioQuery.data;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const isDirty =
    (trimmedName.length > 0 && trimmedName !== s.name) ||
    trimmedDescription !== (s.description ?? "") ||
    JSON.stringify(s.evaluation) !== JSON.stringify(evaluation) ||
    JSON.stringify(s.actions) !== JSON.stringify(actions);
  const saveStatus = update.isPending
    ? "saving"
    : isDirty
      ? "pending"
      : "saved";

  const handleDelete = async () => {
    await remove.mutateAsync(s.id);
    navigate("/scenarios");
  };

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        to="/scenarios"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        All scenarios
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Scenario name"
              disabled={!canEdit}
              className="w-full text-2xl font-bold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:bg-primary-50/30 rounded-none px-1 -ml-1 transition-colors disabled:hover:border-transparent disabled:cursor-not-allowed"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              rows={1}
              disabled={!canEdit}
              className="mt-1 w-full text-sm text-gray-500 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:bg-primary-50/30 px-1 -ml-1 resize-none transition-colors disabled:hover:border-transparent disabled:cursor-not-allowed"
            />
            <div className="mt-3 flex items-center gap-2 text-xs">
              <LinkedWorkflowsBadge links={linksQuery.data?.[s.id] ?? []} />
              {canEdit && <SaveIndicator status={saveStatus} />}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => canEdit && setDeleteOpen(true)}
              disabled={!canEdit}
              title={!canEdit ? READ_ONLY_HINT : undefined}
              className="text-sm py-1.5 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete scenario"
        danger
        confirmLabel="Delete scenario"
        message={
          <>
            <p>
              You're about to delete <strong>{s.name}</strong>. This cannot be
              undone.
            </p>
            <p className="mt-2">
              Any workflow rules-engine steps that link this scenario will lose
              the link automatically.
            </p>
          </>
        }
        busy={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Match conditions
        </h3>
        <QueryGroupCard
          group={evaluation}
          onChange={setEvaluation}
          depth={0}
          isRoot
          canEdit={canEdit}
        />
      </section>

      <section className="mb-6">
        <ActionsEditor
          actions={actions}
          onChange={setActions}
          canEdit={canEdit}
        />
      </section>

      <LinkedWorkflowsSection links={linksQuery.data?.[s.id] ?? []} />
    </div>
  );
};

const LinkedWorkflowsSection = ({
  links,
}: {
  links: Array<{
    workflowId: string;
    workflowStepId: string;
    workflowName: string;
  }>;
}) => {
  if (links.length === 0) {
    return (
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Linked workflows
        </h3>
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500">
          This scenario isn't linked to any workflow's rules-engine step yet —
          it won't run for any customer. Open a workflow's rules-engine step to
          link it.
        </div>
      </section>
    );
  }
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Linked workflows ({links.length})
      </h3>
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {links.map((l) => (
          <Link
            key={l.workflowStepId}
            to={`/workflows/${l.workflowId}`}
            className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50"
          >
            <span className="text-gray-900 font-medium">{l.workflowName}</span>
            <span className="text-xs text-gray-400">Open →</span>
          </Link>
        ))}
      </div>
    </section>
  );
};

const QueryGroupCard = ({
  group,
  onChange,
  onRemove,
  depth,
  isRoot = false,
  canEdit,
}: {
  group: ScenarioEvaluation;
  onChange: (next: ScenarioEvaluation) => void;
  onRemove?: () => void;
  depth: number;
  isRoot?: boolean;
  canEdit: boolean;
}) => {
  const updateOperator = (operator: "AND" | "OR") =>
    onChange({ ...group, operator });

  const addCondition = () =>
    onChange({
      ...group,
      queries: [...group.queries, { attribute: "", operator: "eq", value: "" }],
    });

  const updateCondition = (index: number, next: ScenarioCondition) => {
    const queries = [...group.queries];
    queries[index] = next;
    onChange({ ...group, queries });
  };

  const removeCondition = (index: number) => {
    const queries = group.queries.filter((_, i) => i !== index);
    onChange({ ...group, queries });
  };

  const addNestedGroup = () =>
    onChange({
      ...group,
      queryGroups: [...group.queryGroups, emptyEvaluation()],
    });

  const updateNestedGroup = (index: number, next: ScenarioEvaluation) => {
    const queryGroups = [...group.queryGroups];
    queryGroups[index] = next;
    onChange({ ...group, queryGroups });
  };

  const removeNestedGroup = (index: number) => {
    const queryGroups = group.queryGroups.filter((_, i) => i !== index);
    onChange({ ...group, queryGroups });
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        isRoot
          ? "border-gray-200"
          : "border-gray-200 border-l-4 border-l-primary-300"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
          {(["AND", "OR"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => canEdit && updateOperator(op)}
              disabled={!canEdit}
              className={`px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${
                group.operator === op
                  ? "bg-primary-200 text-primary-800"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        {!isRoot && onRemove && canEdit && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
            aria-label="Remove group"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.queries.length === 0 && group.queryGroups.length === 0 && (
          <div className="text-xs text-gray-400 italic px-1 py-2">
            No conditions yet.
          </div>
        )}

        {group.queries.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            onChange={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
            canEdit={canEdit}
          />
        ))}

        {group.queryGroups.map((g, i) => (
          <QueryGroupCard
            key={i}
            group={g}
            onChange={(next) => updateNestedGroup(i, next)}
            onRemove={() => removeNestedGroup(i)}
            depth={depth + 1}
            canEdit={canEdit}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          disabled={!canEdit}
          title={!canEdit ? READ_ONLY_HINT : undefined}
          onClick={() => canEdit && addCondition()}
          className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <Plus size={12} /> Condition
        </button>
        <button
          type="button"
          disabled={!canEdit}
          title={!canEdit ? READ_ONLY_HINT : undefined}
          onClick={() => canEdit && addNestedGroup()}
          className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <FolderTree size={12} /> Group
        </button>
      </div>
    </div>
  );
};

const ConditionRow = ({
  condition,
  onChange,
  onRemove,
  canEdit,
}: {
  condition: ScenarioCondition;
  onChange: (next: ScenarioCondition) => void;
  onRemove: () => void;
  canEdit: boolean;
}) => {
  const attrDef = useMemo(
    () => SCENARIO_ATTRIBUTES.find((a) => a.key === condition.attribute),
    [condition.attribute],
  );
  const operators = attrDef
    ? OPERATORS_BY_ATTRIBUTE_TYPE[attrDef.type]
    : (Object.keys(OPERATOR_LABELS) as RuleOperator[]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50/70 border border-gray-100">
      <AttributePicker
        value={condition.attribute}
        canEdit={canEdit}
        onChange={(key) => {
          const def = SCENARIO_ATTRIBUTES.find((a) => a.key === key);
          const allowed = def
            ? OPERATORS_BY_ATTRIBUTE_TYPE[def.type]
            : (Object.keys(OPERATOR_LABELS) as RuleOperator[]);
          onChange({
            ...condition,
            attribute: key,
            operator: allowed.includes(condition.operator)
              ? condition.operator
              : (allowed[0] ?? "eq"),
            value: "",
          });
        }}
      />
      <div className="w-[240px]">
        <Select
          value={condition.operator}
          disabled={!canEdit}
          onChange={(v) =>
            onChange({ ...condition, operator: v as RuleOperator })
          }
          options={operators.map((op) => ({
            value: op,
            label: OPERATOR_LABELS[op],
          }))}
        />
      </div>
      <ConditionValueInput
        attrDef={attrDef}
        canEdit={canEdit}
        value={condition.value}
        operator={condition.operator}
        onChange={(value) => onChange({ ...condition, value })}
      />
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
          aria-label="Remove condition"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

const LinkedWorkflowsBadge = ({
  links,
}: {
  links: Array<{ workflowId: string; workflowName: string }>;
}) => {
  if (links.length === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
        Unlinked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
      Linked to {links.length} workflow{links.length === 1 ? "" : "s"}
    </span>
  );
};

const AttributePicker = ({
  value,
  onChange,
  canEdit,
}: {
  value: string;
  onChange: (next: string) => void;
  canEdit: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const attrDef = SCENARIO_ATTRIBUTES.find((a) => a.key === value);

  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        title={!canEdit ? READ_ONLY_HINT : undefined}
        onClick={() => canEdit && setOpen(true)}
        className={`min-w-[260px] h-8 px-3 inline-flex items-center gap-2 bg-white border rounded-lg shadow-sm text-sm text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-200 ${
          attrDef
            ? "border-gray-200 text-gray-900 hover:border-gray-300"
            : "border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:bg-primary-50"
        }`}
      >
        <span className="flex-1 truncate">
          {attrDef ? attrDef.label : "Select attribute…"}
        </span>
        {attrDef && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_BADGE_COLORS[attrDef.type]}`}
          >
            {attrDef.type}
          </span>
        )}
        <ChevronRight size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <AttributePickerModal
          selected={value}
          onPick={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const ConditionValueInput = ({
  attrDef,
  value,
  operator,
  onChange,
  canEdit,
}: {
  attrDef: AttributeDefinition | undefined;
  value: string;
  operator: RuleOperator;
  onChange: (next: string) => void;
  canEdit: boolean;
}) => {
  const isMulti = operator === "in" || operator === "nin";

  if (!attrDef) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Pick an attribute first"
        disabled
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[160px]"
      />
    );
  }

  if (attrDef.type === "boolean") {
    return (
      <div className="w-[120px]">
        <Select
          value={value}
          onChange={onChange}
          disabled={!canEdit}
          placeholder="—"
          options={[
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
        />
      </div>
    );
  }

  if (
    (attrDef.type === "enum" || attrDef.type === "multi-enum") &&
    attrDef.enumValues
  ) {
    const labelFor = (v: string) =>
      attrDef.valueDisplay === "country"
        ? (COUNTRY_NAME_BY_CODE[v as IsoCountryCode] ?? v)
        : v;
    const options = attrDef.enumValues.map((v) => ({
      value: v,
      label: labelFor(v),
    }));
    const widthCls =
      attrDef.valueDisplay === "country" ? "w-[300px]" : "min-w-[220px]";
    // multi-enum attributes only support in/nin (set-intersection) operators,
    // so the value picker is always a MultiSelect.
    const useMulti = isMulti || attrDef.type === "multi-enum";

    if (useMulti) {
      // Comma-separated string ↔ array of values for storage compatibility.
      const selected = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <div className={widthCls}>
          <MultiSelect
            values={selected}
            onChange={(next) => onChange(next.join(","))}
            disabled={!canEdit}
            options={options}
            placeholder="—"
          />
        </div>
      );
    }

    return (
      <div className={widthCls}>
        <Select
          value={value}
          onChange={onChange}
          disabled={!canEdit}
          placeholder="—"
          options={options}
        />
      </div>
    );
  }

  if (attrDef.type === "date") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!canEdit}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
      />
    );
  }

  return (
    <input
      type={attrDef.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!canEdit}
      placeholder={isMulti ? "Comma-separated list" : "Value"}
      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[180px] disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
};

const ActionsEditor = ({
  actions,
  onChange,
  canEdit,
}: {
  actions: ScenarioActionConfig[];
  onChange: (next: ScenarioActionConfig[]) => void;
  canEdit: boolean;
}) => {
  const [type, setType] = useState<ScenarioActionType>("set_customer_status");

  const addAction = () => {
    const defaultValue = (() => {
      switch (type) {
        case "set_customer_status":
          return "flagged";
        case "set_customer_risk_level":
          return "medium";
        case "assign_tag":
          return "";
      }
    })();
    onChange([...actions, { type, value: defaultValue, enabled: true }]);
  };

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Actions ({actions.length})
      </h3>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {actions.length === 0 && (
          <div className="p-5 text-sm text-gray-500">
            No actions yet. Add one below — actions run for every customer that
            matches the conditions above.
          </div>
        )}

        {actions.map((action, i) => (
          <ActionRow
            key={i}
            action={action}
            canEdit={canEdit}
            onChange={(next) => {
              const updated = [...actions];
              updated[i] = next;
              onChange(updated);
            }}
            onRemove={() => onChange(actions.filter((_, idx) => idx !== i))}
          />
        ))}

        <div className="p-5 flex items-end gap-3 bg-gray-50/50">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Action type
            </label>
            <Select
              value={type}
              onChange={(v) => setType(v as ScenarioActionType)}
              disabled={!canEdit}
              options={(Object.keys(ACTION_LABELS) as ScenarioActionType[]).map(
                (t) => ({ value: t, label: ACTION_LABELS[t] }),
              )}
            />
          </div>
          <button
            type="button"
            disabled={!canEdit}
            title={!canEdit ? READ_ONLY_HINT : undefined}
            onClick={() => canEdit && addAction()}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-200 text-primary-800 font-medium rounded-lg text-sm"
          >
            <Plus size={14} /> Add action
          </button>
        </div>
      </div>
    </>
  );
};

const ActionRow = ({
  action,
  canEdit,
  onChange,
  onRemove,
}: {
  action: ScenarioActionConfig;
  canEdit: boolean;
  onChange: (next: ScenarioActionConfig) => void;
  onRemove: () => void;
}) => {
  const Icon = ACTION_ICONS[action.type];

  return (
    <div className="px-5 py-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {ACTION_LABELS[action.type]}
          </span>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() =>
              canEdit && onChange({ ...action, enabled: !action.enabled })
            }
            className={`text-xs px-2 py-0.5 rounded-full font-medium disabled:cursor-not-allowed ${
              action.enabled
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {action.enabled ? "enabled" : "disabled"}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {ACTION_DESCRIPTIONS[action.type]}
        </div>
        <div className="mt-3">
          <ActionValueInput
            action={action}
            onChange={onChange}
            canEdit={canEdit}
          />
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
            aria-label="Remove action"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

const ActionValueInput = ({
  action,
  onChange,
  canEdit,
}: {
  action: ScenarioActionConfig;
  onChange: (next: ScenarioActionConfig) => void;
  canEdit: boolean;
}) => {
  switch (action.type) {
    case "set_customer_status":
      return (
        <div className="w-[200px]">
          <Select
            value={action.value}
            disabled={!canEdit}
            onChange={(v) =>
              onChange({ ...action, value: v as CustomerStatus })
            }
            options={CUSTOMER_STATUS_VALUES.map((v) => ({
              value: v,
              label: v.replace("_", " "),
            }))}
          />
        </div>
      );
    case "set_customer_risk_level":
      return (
        <div className="w-[160px]">
          <Select
            value={action.value}
            disabled={!canEdit}
            onChange={(v) =>
              onChange({ ...action, value: v as CustomerRiskLevel })
            }
            options={CUSTOMER_RISK_LEVELS.map((v) => ({ value: v, label: v }))}
          />
        </div>
      );
    case "assign_tag":
      return (
        <input
          type="text"
          value={action.value}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          disabled={!canEdit}
          placeholder="tag1, tag2 (comma-separated)"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[260px] disabled:opacity-60 disabled:cursor-not-allowed"
        />
      );
  }
};
