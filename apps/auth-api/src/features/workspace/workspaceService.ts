import { HTTPException } from "hono/http-exception";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { EVENTS } from "@usercore/shared-types";

import type { WorkspaceRepository } from "./workspaceRepository";

export const createWorkspaceService = (props: {
  workspaceRepository: WorkspaceRepository;
  rabbitMQ: RabbitMQClient;
  logger: Logger;
}) => {
  const { workspaceRepository, rabbitMQ, logger } = props;

  const createWorkspace = async (data: {
    name: string;
    organizationId: string;
    ownerId: string;
  }) => {
    const slug = data.name.toLowerCase().replace(/\s+/g, "-");

    const workspace = await workspaceRepository.create({
      ...data,
      slug,
    });

    if (!workspace) {
      throw new HTTPException(500, { message: "Failed to create workspace" });
    }

    // Publish workspace.created event
    await rabbitMQ.publish({
      exchange: "usercore.events",
      routingKey: EVENTS.WORKSPACE_CREATED,
      payload: {
        workspaceId: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
      },
    });

    logger.info({ msg: "Workspace created", workspaceId: workspace.id });
    return workspace;
  };

  const getWorkspace = async (id: string) => {
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) {
      throw new HTTPException(404, { message: "Workspace not found" });
    }
    return workspace;
  };

  return { createWorkspace, getWorkspace };
};

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
