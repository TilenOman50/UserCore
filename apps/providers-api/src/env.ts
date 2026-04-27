import { z } from "zod";

// Provider API keys are intentionally optional — without them the clients call
// the real provider endpoints and receive 401, which is the expected state for
// a self-hosted UserCore deployment that hasn't bought a paid plan.
const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "development", "production"]).default("local"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  RABBITMQ_URL: z.string().default("amqp://usercore:usercore@localhost:5672"),

  // iDenfy — identity verification (id-scan, face-scan, liveness)
  IDENFY_API_KEY: z.string().optional(),
  IDENFY_API_SECRET: z.string().optional(),
  IDENFY_BASE_URL: z.string().default("https://ivs.idenfy.com"),
  IDENFY_WEBHOOK_SECRET: z.string().optional(),

  // ComplyAdvantage — AML / sanctions / PEP / adverse media
  COMPLY_ADVANTAGE_API_KEY: z.string().optional(),
  COMPLY_ADVANTAGE_BASE_URL: z
    .string()
    .default("https://api.complyadvantage.com"),

  // IPQualityScore — fraud / IP intelligence
  IPQS_API_KEY: z.string().optional(),
  IPQS_BASE_URL: z.string().default("https://www.ipqualityscore.com/api/json"),
});

export const env = EnvSchema.parse(process.env);
