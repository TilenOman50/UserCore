import { createRabbitMQClient } from "@usercore/rabbitmq";

import { env } from "./env";

// RabbitMQ client — initialized in index.ts before app starts
export const createClients = (props: { logger: import("@usercore/logger").Logger }) => {
  const rabbitMQ = createRabbitMQClient({
    url: env.RABBITMQ_URL,
    logger: props.logger,
  });
  return { rabbitMQ };
};
