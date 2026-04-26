import type { Logger } from "@usercore/logger";

import type { KycDocumentTable } from "../../db/schema.db";
import type { StorageService } from "../../storage/storageService";
import type { DocumentRepository } from "./documentRepository";

export const createDocumentService = (props: {
  documentRepository: DocumentRepository;
  storageService: StorageService;
  logger: Logger;
}) => {
  const { documentRepository, storageService, logger } = props;

  const uploadDocument = async (props: {
    kycSessionId: string;
    documentType: typeof KycDocumentTable.$inferInsert.documentType;
    fileBuffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }) => {
    const key = `kyc/${props.kycSessionId}/${props.documentType}/${Date.now()}-${props.originalFilename}`;

    await storageService.uploadFile({
      key,
      body: props.fileBuffer,
      mimeType: props.mimeType,
    });

    logger.info({
      msg: "Document uploaded",
      sessionId: props.kycSessionId,
      documentType: props.documentType,
    });

    return documentRepository.create({
      kycSessionId: props.kycSessionId,
      documentType: props.documentType,
      minioKey: key,
      originalFilename: props.originalFilename,
      mimeType: props.mimeType,
    });
  };

  const getDocumentsForSession = async (kycSessionId: string) => {
    return documentRepository.findBySessionId(kycSessionId);
  };

  const getSignedUrl = async (minioKey: string) => {
    return storageService.getSignedDownloadUrl(minioKey);
  };

  return { uploadDocument, getDocumentsForSession, getSignedUrl };
};

export type DocumentService = ReturnType<typeof createDocumentService>;
