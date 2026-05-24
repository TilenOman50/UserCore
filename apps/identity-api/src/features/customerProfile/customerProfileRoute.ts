import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { CustomerRiskLevelEnum, KycStatusEnum } from "@usercore/shared-types";

import type { ContextVariables } from "../../types";
import type { CustomerProfileService } from "./customerProfileService";

const CustomerProfileSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  workspaceId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  kycStatus: KycStatusEnum,
  riskLevel: CustomerRiskLevelEnum.nullable(),
  kycSessionId: z.string().nullable(),
  kycCompletedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CustomerListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: KycStatusEnum.optional(),
  riskLevel: CustomerRiskLevelEnum.optional(),
  country: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  // presence = show only archived; absence = exclude archived
  archived: z.enum(["true"]).optional(),
  sortBy: z
    .enum(["createdAt", "firstName", "country", "kycStatus", "riskLevel"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const CustomerListResponse = z.object({
  items: z.array(CustomerProfileSchema),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
});

const CustomerStatsResponse = z.object({
  total: z.number(),
  byStatus: z.array(z.object({ status: KycStatusEnum, count: z.number() })),
  byRisk: z.array(
    z.object({
      riskLevel: CustomerRiskLevelEnum.nullable(),
      count: z.number(),
    }),
  ),
  byCountry: z.array(
    z.object({ country: z.string().nullable(), count: z.number() }),
  ),
  overTime: z.array(z.object({ day: z.string(), count: z.number() })),
});

const CreateProfileSchema = z.object({
  customerId: z.string(),
  workspaceId: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

const UpdateKycStatusSchema = z.object({
  kycStatus: KycStatusEnum,
  kycSessionId: z.string().optional(),
});

const ClassificationSchema = z
  .object({
    kycStatus: KycStatusEnum.optional(),
    riskLevel: CustomerRiskLevelEnum.optional(),
  })
  .refine((d) => d.kycStatus !== undefined || d.riskLevel !== undefined, {
    message: "Provide kycStatus and/or riskLevel",
  });

const serializeProfile = (
  p: NonNullable<Awaited<ReturnType<CustomerProfileService["getProfile"]>>>,
) => ({
  ...p,
  kycCompletedAt: p.kycCompletedAt?.toISOString() ?? null,
  archivedAt: p.archivedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const createCustomerProfileRouter = (props: {
  customerProfileService: CustomerProfileService;
}) => {
  const { customerProfileService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/profiles",
        tags: ["customer-profile"],
        request: {
          body: {
            content: { "application/json": { schema: CreateProfileSchema } },
          },
        },
        responses: {
          201: {
            content: {
              "application/json": { schema: CustomerProfileSchema },
            },
            description: "Created",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const profile = await customerProfileService.createProfile(body);
        return c.json(serializeProfile(profile!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/customer/:customerId",
        tags: ["customer-profile"],
        request: { params: z.object({ customerId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerProfileSchema },
            },
            description: "Profile",
          },
          404: {
            content: {
              "application/json": { schema: z.object({ error: z.string() }) },
            },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { customerId } = c.req.valid("param");
        const profile = await customerProfileService.getProfile(customerId);
        if (!profile) {
          return c.json({ error: "Customer profile not found" }, 404);
        }
        return c.json(serializeProfile(profile), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/workspace/:workspaceId",
        tags: ["customer-profile"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.array(CustomerProfileSchema),
              },
            },
            description: "Profiles",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const profiles =
          await customerProfileService.listByWorkspace(workspaceId);
        return c.json(profiles.map(serializeProfile));
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/workspace/:workspaceId/table",
        tags: ["customer-profile"],
        request: {
          params: z.object({ workspaceId: z.string() }),
          query: CustomerListQuery,
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerListResponse },
            },
            description: "Filtered, paginated customers",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const q = c.req.valid("query");
        const result = await customerProfileService.listCustomers({
          workspaceId,
          page: q.page,
          limit: q.limit,
          status: q.status,
          riskLevel: q.riskLevel,
          country: q.country,
          search: q.search,
          fromDate: q.fromDate,
          toDate: q.toDate,
          archived: q.archived === "true",
          sortBy: q.sortBy,
          sortDir: q.sortDir,
        });
        return c.json({
          ...result,
          items: result.items.map(serializeProfile),
        });
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/workspace/:workspaceId/stats",
        tags: ["customer-profile"],
        request: {
          params: z.object({ workspaceId: z.string() }),
          query: z.object({
            range: z
              .enum(["all", "24h", "week", "month", "year"])
              .default("all"),
          }),
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerStatsResponse },
            },
            description: "Customer aggregations for charts",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const { range } = c.req.valid("query");
        const stats = await customerProfileService.getStats(workspaceId, range);
        return c.json(stats);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/profiles/customer/:customerId/kyc-status",
        tags: ["customer-profile"],
        request: {
          params: z.object({ customerId: z.string() }),
          body: {
            content: { "application/json": { schema: UpdateKycStatusSchema } },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerProfileSchema },
            },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { customerId } = c.req.valid("param");
        const body = c.req.valid("json");
        const profile = await customerProfileService.updateKycStatus({
          customerId,
          ...body,
        });
        return c.json(serializeProfile(profile!));
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/profiles/customer/:customerId/archive",
        tags: ["customer-profile"],
        request: {
          params: z.object({ customerId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({ archived: z.boolean() }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerProfileSchema },
            },
            description: "Updated",
          },
          404: {
            content: {
              "application/json": { schema: z.object({ error: z.string() }) },
            },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { customerId } = c.req.valid("param");
        const { archived } = c.req.valid("json");
        const profile = await customerProfileService.setArchived(
          customerId,
          archived,
        );
        if (!profile) {
          return c.json({ error: "Customer profile not found" }, 404);
        }
        return c.json(serializeProfile(profile), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/profiles/customer/:customerId/classification",
        tags: ["customer-profile"],
        request: {
          params: z.object({ customerId: z.string() }),
          body: {
            content: { "application/json": { schema: ClassificationSchema } },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: CustomerProfileSchema },
            },
            description: "Updated",
          },
          404: {
            content: {
              "application/json": { schema: z.object({ error: z.string() }) },
            },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { customerId } = c.req.valid("param");
        const body = c.req.valid("json");
        const profile = await customerProfileService.setClassification(
          customerId,
          body,
        );
        if (!profile) {
          return c.json({ error: "Customer profile not found" }, 404);
        }
        return c.json(serializeProfile(profile), 200);
      },
    );
};
