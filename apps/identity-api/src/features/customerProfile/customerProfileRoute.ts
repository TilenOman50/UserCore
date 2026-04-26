import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { KycStatusEnum } from "@usercore/shared-types";

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
  kycSessionId: z.string().nullable(),
  kycCompletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

const serializeProfile = (
  p: NonNullable<Awaited<ReturnType<CustomerProfileService["getProfile"]>>>,
) => ({
  ...p,
  kycCompletedAt: p.kycCompletedAt?.toISOString() ?? null,
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
    );
};
