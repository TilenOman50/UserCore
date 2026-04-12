import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { KycDocumentTable } from "../../db/schema.db";

export const createDocumentRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    kycSessionId: string;
    documentType: typeof KycDocumentTable.$inferInsert.documentType;
    minioKey: string;
    originalFilename: string;
    mimeType: string;
  }) => {
    const [doc] = await db.insert(KycDocumentTable).values(data).returning();
    return doc;
  };

  const findBySessionId = async (kycSessionId: string) => {
    return db
      .select()
      .from(KycDocumentTable)
      .where(eq(KycDocumentTable.kycSessionId, kycSessionId));
  };

  return { create, findBySessionId };
};

export type DocumentRepository = ReturnType<typeof createDocumentRepository>;
