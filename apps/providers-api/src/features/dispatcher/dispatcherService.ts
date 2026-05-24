import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  PROVIDER_EVENTS,
  ProviderCheckRequestedPayload,
  type ProviderCheckCompletedPayload,
  type ProviderShortName,
  type WorkflowSessionStatus,
  type WorkflowStepType,
} from "@usercore/shared-types";

import type { ComplyAdvantageClient } from "../complyAdvantage/complyAdvantageClient";
import type { IpQualityScoreClient } from "../ipQualityScore/ipQualityScoreClient";

const QUEUE = "providers-api.check-requested";

type DispatchHandler = (request: ProviderCheckRequestedPayload) => Promise<{
  status: WorkflowSessionStatus;
  rawPayload: Record<string, unknown>;
  message?: string;
}>;

const notImplemented: DispatchHandler = async (req) => {
  throw new Error(
    `No handler registered for ${req.workflowStepType} + ${req.providerShortName}`,
  );
};

export const registerProviderDispatcher = async (props: {
  rabbitMQ: RabbitMQClient;
  complyAdvantageClient: ComplyAdvantageClient;
  ipQualityScoreClient: IpQualityScoreClient;
  logger: Logger;
}) => {
  const { rabbitMQ, complyAdvantageClient, ipQualityScoreClient, logger } =
    props;

  // (workflowStepType, providerShortName) → handler. Keys for unimplemented
  // combinations fall through to notImplemented and are logged so the
  // dispatcher fails closed instead of silently dropping events.
  const dispatchTable: Record<
    WorkflowStepType,
    Partial<Record<ProviderShortName, DispatchHandler>>
  > = {
    "identity-verification": {
      // iDenfy is initiated synchronously via /providers/idenfy/sessions and
      // completes via webhook — no event-driven dispatch needed.
    },
    "aml-screening": {
      complyAdvantage: async (req) => {
        // Sandbox short-circuit: return a canned "clean" result without
        // hitting ComplyAdvantage. Integrators get to wire decision rules
        // against a predictable response, and the org doesn't burn API
        // credits on test traffic.
        if (req.verificationMode === "sandbox") {
          logger.info({
            msg: "ComplyAdvantage check stubbed — sandbox mode",
            sessionId: req.workflowSessionId,
          });
          // Shaped like a real ComplyAdvantage response so the completion
          // service flattens rich detail (risk level, hits, categories). A
          // clean "no hits, low risk" mock for predictable sandbox demos.
          return {
            status: "SUCCEEDED",
            rawPayload: {
              sandbox: true,
              content: {
                data: {
                  id: Math.floor(Math.random() * 1_000_000_000),
                  ref: `sandbox-${req.workflowSessionId}`,
                  match_status: "no_match",
                  risk_level: "low",
                  total_hits: 0,
                  hits: [],
                },
              },
            },
            message: "sandbox · 0 hits, risk=low",
          };
        }
        const searchTerm = String(req.data.searchTerm ?? "");
        // payload.credentials is populated by workflows-api when the
        // step is wired BYO — null falls back to env-managed inside the
        // client.
        const result = await complyAdvantageClient.search(
          {
            searchTerm,
            clientRef: req.workflowSessionId,
            birthYear:
              typeof req.data.birthYear === "number"
                ? req.data.birthYear
                : undefined,
          },
          req.credentials?.apiKey ?? null,
        );
        const status: WorkflowSessionStatus =
          result.matchStatus === "no_match"
            ? "SUCCEEDED"
            : result.matchStatus === "true_positive"
              ? "FAILED"
              : "REQUIRES_REVIEW";
        return {
          status,
          rawPayload: result.raw,
          message: `${result.totalHits} hits, risk=${result.riskLevel}`,
        };
      },
    },
    "fraud-detection": {
      ipQualityScore: async (req) => {
        if (req.verificationMode === "sandbox") {
          logger.info({
            msg: "IPQS check stubbed — sandbox mode",
            sessionId: req.workflowSessionId,
          });
          // Snake-case top-level fields matching what the completion service
          // flattens (fraud_score, country_code, flags). Clean low-risk mock.
          return {
            status: "SUCCEEDED",
            rawPayload: {
              sandbox: true,
              fraud_score: 5,
              country_code: "SI",
              vpn: false,
              tor: false,
              proxy: false,
              is_crawler: false,
              recent_abuse: false,
              bot_status: false,
              connection_type: "Residential",
              ISP: "Telekom Slovenije",
              region: "Ljubljana",
              city: "Ljubljana",
            },
            message: "sandbox · fraud_score=5",
          };
        }
        const ip = String(req.data.ip ?? "");
        const result = await ipQualityScoreClient.checkIp(
          { ip },
          req.credentials?.apiKey ?? null,
        );
        // Threshold of 75 is the default IPQS recommendation for "high risk".
        const status: WorkflowSessionStatus =
          result.fraudScore >= 75 ? "FAILED" : "SUCCEEDED";
        return {
          status,
          rawPayload: result.raw,
          message: `fraud_score=${result.fraudScore}`,
        };
      },
    },
    "duplicate-detection": {},
    "rules-engine": {},
  };

  await rabbitMQ.subscribe({
    exchange: "usercore.events",
    routingKey: PROVIDER_EVENTS.CHECK_REQUESTED,
    queue: QUEUE,
    handler: async (raw) => {
      const parsed = ProviderCheckRequestedPayload.safeParse(raw);
      if (!parsed.success) {
        logger.warn({
          msg: "Invalid providers.check.requested payload",
          error: parsed.error.message,
        });
        return;
      }
      const req = parsed.data;
      const handler =
        dispatchTable[req.workflowStepType]?.[req.providerShortName] ??
        notImplemented;

      const completed: ProviderCheckCompletedPayload = await (async () => {
        try {
          const out = await handler(req);
          return {
            workflowSessionId: req.workflowSessionId,
            workflowStepType: req.workflowStepType,
            providerShortName: req.providerShortName,
            status: out.status,
            message: out.message,
            rawPayload: out.rawPayload,
          };
        } catch (err) {
          logger.error({
            msg: "Provider dispatch failed",
            workflowStepType: req.workflowStepType,
            providerShortName: req.providerShortName,
            error: err instanceof Error ? err.message : String(err),
          });
          return {
            workflowSessionId: req.workflowSessionId,
            workflowStepType: req.workflowStepType,
            providerShortName: req.providerShortName,
            status: "FAILED" as WorkflowSessionStatus,
            message: err instanceof Error ? err.message : "Dispatch failed",
            rawPayload: {},
          };
        }
      })();

      await rabbitMQ.publish({
        exchange: "usercore.events",
        routingKey: PROVIDER_EVENTS.CHECK_COMPLETED,
        payload: completed,
      });
    },
  });
};
