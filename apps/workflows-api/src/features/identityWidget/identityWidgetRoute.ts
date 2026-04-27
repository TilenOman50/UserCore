import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { IdentityWidget } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { IdentityWidgetService } from "./identityWidgetService";

const WidgetSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  name: z.string().nullable(),
  logoS3ObjectKey: z.string().nullable(),
  logoUrl: z.string().nullable(),
  coverS3ObjectKey: z.string().nullable(),
  coverUrl: z.string().nullable(),
  showCoverImage: z.boolean(),
  brandingMainColor: z.string().nullable(),
  brandingCtaColor: z.string().nullable(),
  brandingSecondaryColor: z.string().nullable(),
  bottomContentTitle: z.string().nullable(),
  bottomContentLink: z.string().nullable(),
  bottomContentDescription: z.string().nullable(),
  hosts: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const BareWidgetSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  name: z.string().nullable(),
  logoS3ObjectKey: z.string().nullable(),
  coverS3ObjectKey: z.string().nullable(),
  showCoverImage: z.boolean(),
  brandingMainColor: z.string().nullable(),
  brandingCtaColor: z.string().nullable(),
  brandingSecondaryColor: z.string().nullable(),
  bottomContentTitle: z.string().nullable(),
  bottomContentLink: z.string().nullable(),
  bottomContentDescription: z.string().nullable(),
  hosts: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const UpdateSchema = z.object({
  name: z.string().nullable().optional(),
  showCoverImage: z.boolean().optional(),
  brandingMainColor: z.string().nullable().optional(),
  brandingCtaColor: z.string().nullable().optional(),
  brandingSecondaryColor: z.string().nullable().optional(),
  bottomContentTitle: z.string().nullable().optional(),
  bottomContentLink: z.string().nullable().optional(),
  bottomContentDescription: z.string().nullable().optional(),
  hosts: z.array(z.string()).optional(),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeBare = (w: IdentityWidget) => ({
  id: w.id,
  workflowId: w.workflowId,
  name: w.name,
  logoS3ObjectKey: w.logoS3ObjectKey,
  coverS3ObjectKey: w.coverS3ObjectKey,
  showCoverImage: w.showCoverImage,
  brandingMainColor: w.brandingMainColor,
  brandingCtaColor: w.brandingCtaColor,
  brandingSecondaryColor: w.brandingSecondaryColor,
  bottomContentTitle: w.bottomContentTitle,
  bottomContentLink: w.bottomContentLink,
  bottomContentDescription: w.bottomContentDescription,
  hosts: w.hosts,
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
});

const serializeWithUrls = (
  w: IdentityWidget & { logoUrl: string | null; coverUrl: string | null },
) => ({
  ...serializeBare(w),
  logoUrl: w.logoUrl,
  coverUrl: w.coverUrl,
});

export const createIdentityWidgetRouter = (props: {
  identityWidgetService: IdentityWidgetService;
}) => {
  const { identityWidgetService } = props;

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  // Multipart logo upload — registered as a plain Hono route since OpenAPIHono
  // multipart support is awkward; the dashboard uses fetch + FormData.
  app.post("/workflows/:workflowId/widget/logo", async (c) => {
    const { workflowId } = c.req.param();
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "file is required" }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const widget = await identityWidgetService.uploadImage({
      workflowId,
      kind: "logo",
      fileBuffer: buffer,
      mimeType: file.type,
    });
    return c.json(serializeBare(widget!), 200);
  });

  app.post("/workflows/:workflowId/widget/cover", async (c) => {
    const { workflowId } = c.req.param();
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "file is required" }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const widget = await identityWidgetService.uploadImage({
      workflowId,
      kind: "cover",
      fileBuffer: buffer,
      mimeType: file.type,
    });
    return c.json(serializeBare(widget!), 200);
  });

  return app
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/widget",
        tags: ["widget"],
        request: { params: z.object({ workflowId: z.string() }) },
        responses: {
          201: {
            content: { "application/json": { schema: BareWidgetSchema } },
            description: "Created or existing",
          },
        },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        const widget =
          await identityWidgetService.ensureForWorkflow(workflowId);
        return c.json(serializeBare(widget!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflows/:workflowId/widget",
        tags: ["widget"],
        request: { params: z.object({ workflowId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: WidgetSchema } },
            description: "Widget config",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        const widget = await identityWidgetService.getForWorkflow(workflowId);
        if (!widget) return c.json({ error: "Widget not found" }, 404);
        return c.json(serializeWithUrls(widget), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflows/:workflowId/widget",
        tags: ["widget"],
        request: {
          params: z.object({ workflowId: z.string() }),
          body: {
            content: { "application/json": { schema: UpdateSchema } },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: BareWidgetSchema } },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        const body = c.req.valid("json");
        const widget = await identityWidgetService.updateForWorkflow(
          workflowId,
          body,
        );
        return c.json(serializeBare(widget!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflows/:workflowId/widget",
        tags: ["widget"],
        request: { params: z.object({ workflowId: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        await identityWidgetService.removeForWorkflow(workflowId);
        return c.body(null, 204);
      },
    );
};
