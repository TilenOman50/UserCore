import type { Logger } from "@usercore/logger";
import type { ProviderShortName } from "@usercore/shared-types";

import type { WorkflowsRepository } from "../workflows/workflowsRepository";
import type { WorkflowSessionsRepository } from "../workflowSessions/workflowSessionsRepository";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type { ProviderConfigurationsRepository } from "./providerConfigurationsRepository";

// What the dispatcher needs at runtime — either BYO with raw credentials
// (then route through the customer's account) or a "managed" signal that
// tells the dispatcher to fall back to env keys.
export type EffectiveProviderConfig =
  | { mode: "byo"; apiKey: string; apiSecret: string | null }
  | { mode: "managed" };

export const createProviderConfigurationsService = (props: {
  repository: ProviderConfigurationsRepository;
  sessionsRepository: WorkflowSessionsRepository;
  workflowsRepository: WorkflowsRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  logger: Logger;
}) => {
  const {
    repository,
    sessionsRepository,
    workflowsRepository,
    workflowStepsRepository,
    logger,
  } = props;

  const listForOrganization = (organizationId: string) =>
    repository.listByOrganization(organizationId);

  const upsert = async (data: {
    organizationId: string;
    provider: ProviderShortName;
    apiKey: string | null;
    apiSecret: string | null;
    enabled: boolean;
    createdBy?: string | null;
  }) => {
    logger.info({
      msg: "Upserting provider configuration",
      organizationId: data.organizationId,
      provider: data.provider,
      enabled: data.enabled,
    });
    return repository.upsert({
      organizationId: data.organizationId,
      provider: data.provider,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      enabled: data.enabled,
      createdBy: data.createdBy ?? null,
    });
  };

  const remove = async (data: {
    organizationId: string;
    provider: ProviderShortName;
  }) => {
    const config = await repository.findByOrgAndProvider(data);
    if (!config) return;
    await repository.remove(config.id);
  };

  // Resolves the effective dispatch credentials for a given workflow session
  // and provider. Used by providers-api (iDenfy session creation) and by
  // workflows-api itself when fanning out CHECK_REQUESTED events. Returns
  // unmasked credentials — must NOT be exposed on a public route.
  //
  // The choice between managed and BYO lives on the workflow step itself
  // (providerCredentialMode), not on the org-wide provider configuration.
  // That way the same workflow can mix "managed iDenfy" + "BYO AML" etc.
  // BYO falls back to managed if no credentials are saved for the org —
  // never crash a session because the operator forgot to paste a key.
  const getEffectiveConfig = async (data: {
    workflowSessionId: string;
    provider: ProviderShortName;
  }): Promise<EffectiveProviderConfig> => {
    const session = await sessionsRepository.findById(data.workflowSessionId);
    if (!session) {
      logger.warn({
        msg: "Effective config requested for unknown session — defaulting to managed",
        sessionId: data.workflowSessionId,
      });
      return { mode: "managed" };
    }
    const workflow = await workflowsRepository.findById(session.workflowId);
    if (!workflow) return { mode: "managed" };

    const steps = await workflowStepsRepository.findByWorkflowId(
      session.workflowId,
    );
    const matchingStep = steps.find((s) => s.provider === data.provider);
    if (!matchingStep || matchingStep.providerCredentialMode !== "byo") {
      return { mode: "managed" };
    }

    const config = await repository.findByOrgAndProvider({
      organizationId: workflow.organizationId,
      provider: data.provider,
    });
    if (!config || !config.apiKey) {
      logger.warn({
        msg: "Step wired to BYO but no credentials saved — using managed",
        sessionId: data.workflowSessionId,
        provider: data.provider,
      });
      return { mode: "managed" };
    }
    return {
      mode: "byo",
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
    };
  };

  return {
    listForOrganization,
    upsert,
    remove,
    getEffectiveConfig,
  };
};

export type ProviderConfigurationsService = ReturnType<
  typeof createProviderConfigurationsService
>;
