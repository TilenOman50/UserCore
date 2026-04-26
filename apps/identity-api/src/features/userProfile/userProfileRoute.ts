import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { KycStatusEnum } from "@usercore/shared-types";

import type { ContextVariables } from "../../types";
import type { UserProfileService } from "./userProfileService";

const UserProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
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
  userId: z.string(),
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
  p: NonNullable<Awaited<ReturnType<UserProfileService["getProfile"]>>>,
) => ({
  ...p,
  kycCompletedAt: p.kycCompletedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const createUserProfileRouter = (props: {
  userProfileService: UserProfileService;
}) => {
  const { userProfileService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/profiles",
        tags: ["user-profile"],
        request: {
          body: {
            content: { "application/json": { schema: CreateProfileSchema } },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: UserProfileSchema } },
            description: "Created",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const profile = await userProfileService.createProfile(body);
        return c.json(serializeProfile(profile!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/user/:userId",
        tags: ["user-profile"],
        request: { params: z.object({ userId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: UserProfileSchema } },
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
        const { userId } = c.req.valid("param");
        const profile = await userProfileService.getProfile(userId);
        if (!profile) {
          return c.json({ error: "User profile not found" }, 404);
        }
        return c.json(serializeProfile(profile), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/profiles/workspace/:workspaceId",
        tags: ["user-profile"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: z.array(UserProfileSchema) },
            },
            description: "Profiles",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const profiles = await userProfileService.listByWorkspace(workspaceId);
        return c.json(profiles.map(serializeProfile));
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/profiles/user/:userId/kyc-status",
        tags: ["user-profile"],
        request: {
          params: z.object({ userId: z.string() }),
          body: {
            content: { "application/json": { schema: UpdateKycStatusSchema } },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: UserProfileSchema } },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { userId } = c.req.valid("param");
        const body = c.req.valid("json");
        const profile = await userProfileService.updateKycStatus({
          userId,
          ...body,
        });
        return c.json(serializeProfile(profile!));
      },
    );
};
