import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  PROVIDER_EVENTS,
  ProviderCheckCompletedPayload,
  type ProviderShortName,
  type WorkflowStepType,
} from "@usercore/shared-types";

import type { ComplyAdvantageCheckCompletedService } from "./providerCheckCompletedServices/complyAdvantageCheckCompletedService";
import type { IdenfyCheckCompletedService } from "./providerCheckCompletedServices/idenfyCheckCompletedService";
import type { IpQualityScoreCheckCompletedService } from "./providerCheckCompletedServices/ipQualityScoreCheckCompletedService";

const QUEUE = "workflows-api.provider-check-completed";

type Handler = (payload: ProviderCheckCompletedPayload) => Promise<void>;

export const registerProviderCheckCompletedConsumer = async (props: {
  rabbitMQ: RabbitMQClient;
  idenfyCheckCompletedService: IdenfyCheckCompletedService;
  complyAdvantageCheckCompletedService: ComplyAdvantageCheckCompletedService;
  ipQualityScoreCheckCompletedService: IpQualityScoreCheckCompletedService;
  logger: Logger;
}) => {
  const {
    rabbitMQ,
    idenfyCheckCompletedService,
    complyAdvantageCheckCompletedService,
    ipQualityScoreCheckCompletedService,
    logger,
  } = props;

  const handlers: Record<
    WorkflowStepType,
    Partial<Record<ProviderShortName, Handler>>
  > = {
    "identity-verification": {
      idenfy: idenfyCheckCompletedService.handleCompleted,
    },
    "aml-screening": {
      complyAdvantage: complyAdvantageCheckCompletedService.handleCompleted,
    },
    "fraud-detection": {
      ipQualityScore: ipQualityScoreCheckCompletedService.handleCompleted,
    },
    "duplicate-detection": {},
    "rules-engine": {},
  };

  await rabbitMQ.subscribe({
    exchange: "usercore.events",
    routingKey: PROVIDER_EVENTS.CHECK_COMPLETED,
    queue: QUEUE,
    handler: async (raw) => {
      const parsed = ProviderCheckCompletedPayload.safeParse(raw);
      if (!parsed.success) {
        logger.warn({
          msg: "Invalid providers.check.completed payload",
          error: parsed.error.message,
        });
        return;
      }
      const payload = parsed.data;
      const handler =
        handlers[payload.workflowStepType]?.[payload.providerShortName];
      if (!handler) {
        logger.warn({
          msg: "No handler for provider check.completed",
          workflowStepType: payload.workflowStepType,
          providerShortName: payload.providerShortName,
        });
        return;
      }
      await handler(payload);
    },
  });
};
