import type { Logger } from "@usercore/logger";

import type { WorkspaceRepository } from "./workspaceRepository";

export const createWorkspaceService = (props: {
  workspaceRepository: WorkspaceRepository;
  logger: Logger;
}) => {
  const { workspaceRepository, logger } = props;

  const getSettings = async (workspaceId: string) => {
    return workspaceRepository.findSettingsByWorkspaceId(workspaceId);
  };

  const updateSettings = async (data: {
    workspaceId: string;
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
  }) => {
    logger.info({
      msg: "Updating workspace settings",
      workspaceId: data.workspaceId,
    });
    return workspaceRepository.upsertSettings(data);
  };

  return { getSettings, updateSettings };
};

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
