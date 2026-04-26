import amqplib from "amqplib";

import type { Logger } from "@usercore/logger";

export type RabbitMQEvent = {
  exchange: string;
  routingKey: string;
  payload: unknown;
};

export type EventHandler = (payload: unknown) => Promise<void>;

export const createRabbitMQClient = (props: {
  url: string;
  logger: Logger;
}) => {
  const { url, logger } = props;
  let connection: amqplib.ChannelModel | null = null;
  let channel: amqplib.Channel | null = null;

  const connect = async () => {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();
    logger.info({ msg: "RabbitMQ connected" });
  };

  const publish = async (event: RabbitMQEvent) => {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    await channel.assertExchange(event.exchange, "topic", { durable: true });
    channel.publish(
      event.exchange,
      event.routingKey,
      Buffer.from(JSON.stringify(event.payload)),
      { persistent: true },
    );
  };

  const subscribe = async (props: {
    exchange: string;
    routingKey: string;
    queue: string;
    handler: EventHandler;
  }) => {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    await channel.assertExchange(props.exchange, "topic", { durable: true });
    await channel.assertQueue(props.queue, { durable: true });
    await channel.bindQueue(props.queue, props.exchange, props.routingKey);
    await channel.consume(props.queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as unknown;
        await props.handler(payload);
        channel!.ack(msg);
      } catch (err) {
        logger.error({ msg: "Error handling RabbitMQ message", error: err });
        channel!.nack(msg, false, false);
      }
    });
  };

  const shutdown = async () => {
    await channel?.close();
    await connection?.close();
    logger.info({ msg: "RabbitMQ disconnected" });
  };

  return { connect, publish, subscribe, shutdown };
};

export type RabbitMQClient = ReturnType<typeof createRabbitMQClient>;
