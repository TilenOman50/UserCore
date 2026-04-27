import { z } from "zod";

const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "development", "production"]).default("local"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("usercore"),
  DB_PASSWORD: z.string().default("usercore"),
  DB_DATABASE: z.string().default("usercore_workflows"),
  RABBITMQ_URL: z.string().default("amqp://usercore:usercore@localhost:5672"),
  MINIO_ENDPOINT: z.string().default("http://localhost:9000"),
  MINIO_ACCESS_KEY: z.string().default("usercore"),
  MINIO_SECRET_KEY: z.string().default("usercore123"),
  MINIO_BUCKET: z.string().default("kyc-documents"),
  // Used to look up an organization's plan when enforcing per-org quotas
  // (e.g. the verifications-per-month hard cap on session creation).
  AUTH_API_URL: z.string().default("http://localhost:3001"),
});

export const env = EnvSchema.parse(process.env);
