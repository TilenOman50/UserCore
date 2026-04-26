import type { Logger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { env } from "./env";

export const createClients = (props: { logger: Logger }) => {
  const rabbitMQ = createRabbitMQClient({
    url: env.RABBITMQ_URL,
    logger: props.logger,
  });
  return { rabbitMQ };
};
