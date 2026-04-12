import { z } from "zod";

const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "development", "production"]).default("local"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("usercore"),
  DB_PASSWORD: z.string().default("usercore"),
  DB_DATABASE: z.string().default("usercore_identity"),
  RABBITMQ_URL: z.string().default("amqp://usercore:usercore@localhost:5672"),
});

export const env = EnvSchema.parse(process.env);
