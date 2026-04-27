import type { Logger } from "@usercore/logger";

import type { StorageService } from "../../storage/storageService";
import type {
  IdentityWidgetRepository,
  IdentityWidgetUpdate,
} from "./identityWidgetRepository";

export const createIdentityWidgetService = (props: {
  identityWidgetRepository: IdentityWidgetRepository;
  storageService: StorageService;
  logger: Logger;
}) => {
  const { identityWidgetRepository, storageService, logger } = props;

  const ensureForWorkflow = async (workflowId: string) => {
    const existing =
      await identityWidgetRepository.findByWorkflowId(workflowId);
    if (existing) return existing;
    logger.info({ msg: "Creating default widget", workflowId });
    return identityWidgetRepository.create({ workflowId });
  };

  const getForWorkflow = async (workflowId: string) => {
    const widget =
      await identityWidgetRepository.findByWorkflowId(workflowId);
    if (!widget) return null;
    const [logoUrl, coverUrl] = await Promise.all([
      widget.logoS3ObjectKey
        ? storageService.getSignedDownloadUrl(widget.logoS3ObjectKey)
        : Promise.resolve(null),
      widget.coverS3ObjectKey
        ? storageService.getSignedDownloadUrl(widget.coverS3ObjectKey)
        : Promise.resolve(null),
    ]);
    return { ...widget, logoUrl, coverUrl };
  };

  const updateForWorkflow = async (
    workflowId: string,
    data: IdentityWidgetUpdate,
  ) => {
    return identityWidgetRepository.update(workflowId, data);
  };

  const uploadImage = async (data: {
    workflowId: string;
    kind: "logo" | "cover";
    fileBuffer: Buffer;
    mimeType: string;
  }) => {
    const key = `widgets/${data.workflowId}/${data.kind}-${Date.now()}`;
    await storageService.uploadFile({
      key,
      body: data.fileBuffer,
      mimeType: data.mimeType,
    });
    const update: IdentityWidgetUpdate =
      data.kind === "logo"
        ? { logoS3ObjectKey: key }
        : { coverS3ObjectKey: key };
    return identityWidgetRepository.update(data.workflowId, update);
  };

  const removeForWorkflow = async (workflowId: string) => {
    await identityWidgetRepository.remove(workflowId);
  };

  return {
    ensureForWorkflow,
    getForWorkflow,
    updateForWorkflow,
    uploadImage,
    removeForWorkflow,
  };
};

export type IdentityWidgetService = ReturnType<
  typeof createIdentityWidgetService
>;
