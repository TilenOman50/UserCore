import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ProviderShortNameEnum } from "@usercore/shared-types";

import type { ProviderConfiguration } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { ProviderConfigurationsService } from "./providerConfigurationsService";

const ConfigSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  provider: ProviderShortNameEnum,
  apiKey: z.string().nullable(),
  apiSecret: z.string().nullable(),
  enabled: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

// API keys are echoed back masked — full secret is never returned to the
// dashboard after first save. Officers can clear + re-enter, but the value
// can't be exfiltrated through a curl on this endpoint.
const maskSecret = (value: string | null): string | null => {
  if (!value) return null;
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
};

const serialize = (c: ProviderConfiguration) => ({
  id: c.id,
  organizationId: c.organizationId,
  provider: c.provider,
  apiKey: maskSecret(c.apiKey),
  apiSecret: maskSecret(c.apiSecret),
  enabled: c.enabled,
  createdBy: c.createdBy,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

export const createProviderConfigurationsRouter = (props: {
  providerConfigurationsService: ProviderConfigurationsService;
}) => {
  const { providerConfigurationsService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "get",
        path: "/provider-configurations",
        tags: ["provider-configurations"],
        request: {
          query: z.object({ organizationId: z.string() }),
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: z.array(ConfigSchema) },
            },
            description: "Provider configurations for the organization",
          },
        },
      }),
      async (c) => {
        const { organizationId } = c.req.valid("query");
        const rows =
          await providerConfigurationsService.listForOrganization(
            organizationId,
          );
        return c.json(rows.map(serialize), 200);
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/provider-configurations",
        tags: ["provider-configurations"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  organizationId: z.string(),
                  provider: ProviderShortNameEnum,
                  // Clients can pass empty string / null to clear a field.
                  apiKey: z.string().nullable(),
                  apiSecret: z.string().nullable(),
                  enabled: z.boolean(),
                  createdBy: z.string().nullable().optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: ConfigSchema } },
            description: "Saved configuration",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const row = await providerConfigurationsService.upsert(body);
        return c.json(serialize(row), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/provider-configurations/effective",
        tags: ["provider-configurations"],
        // Internal lookup used by providers-api at dispatch time to figure
        // out whether a check should route through the customer's BYO
        // credentials or fall back to env-managed ones. Returns UNMASKED
        // credentials, so it must stay inside the trust boundary — the
        // gateway in production would block external callers on this path.
        request: {
          query: z.object({
            workflowSessionId: z.string(),
            provider: ProviderShortNameEnum,
          }),
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.union([
                  z.object({
                    mode: z.literal("byo"),
                    apiKey: z.string(),
                    apiSecret: z.string().nullable(),
                  }),
                  z.object({ mode: z.literal("managed") }),
                ]),
              },
            },
            description: "Effective dispatch credentials",
          },
        },
      }),
      async (c) => {
        const { workflowSessionId, provider } = c.req.valid("query");
        const result = await providerConfigurationsService.getEffectiveConfig({
          workflowSessionId,
          provider,
        });
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/provider-configurations",
        tags: ["provider-configurations"],
        request: {
          query: z.object({
            organizationId: z.string(),
            provider: ProviderShortNameEnum,
          }),
        },
        responses: {
          204: { description: "Deleted" },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { organizationId, provider } = c.req.valid("query");
        await providerConfigurationsService.remove({
          organizationId,
          provider,
        });
        return c.body(null, 204);
      },
    );
};
