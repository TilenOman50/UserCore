import { z } from "zod";

const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "development", "production"]).default("local"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("usercore"),
  DB_PASSWORD: z.string().default("usercore"),
  DB_DATABASE: z.string().default("usercore_auth"),

  RABBITMQ_URL: z.string().default("amqp://usercore:usercore@localhost:5672"),

  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default("noreply@usercore.local"),
});

export const env = EnvSchema.parse(process.env);
