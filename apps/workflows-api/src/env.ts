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
  // In-house rules engine lives in scenarios-api; the rules-engine check calls
  // its synchronous /scenarios/evaluate endpoint during a session.
  SCENARIOS_API_URL: z.string().default("http://localhost:3005"),
  // SMTP — points at Mailpit in local dev (port 1025, no auth).
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default("noreply@usercore.local"),
  // Used to build the resume deep-link in resubmission emails. WIDGET_URL is
  // where the customer-facing widget is served; WORKFLOWS_PUBLIC_URL is this
  // API's externally-reachable base (passed to the widget as ?workflowsApi).
  WIDGET_URL: z.string().default("http://localhost:3007"),
  WORKFLOWS_PUBLIC_URL: z.string().default("http://localhost:3004"),
});

export const env = EnvSchema.parse(process.env);
