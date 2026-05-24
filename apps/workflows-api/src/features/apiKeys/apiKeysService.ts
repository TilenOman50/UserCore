import { createHash, randomBytes } from "node:crypto";

import type { Logger } from "@usercore/logger";

import type { ApiKey } from "../../db/schema.db";
import type { ApiKeysRepository } from "./apiKeysRepository";

// Raw secret format: uc_<32 url-safe chars>. Shown to the operator exactly once
// on creation; only the SHA-256 hash + a short display prefix are persisted.
const RAW_PREFIX = "uc_";
const PREFIX_DISPLAY_LEN = RAW_PREFIX.length + 8;

const generateRawKey = () =>
  `${RAW_PREFIX}${randomBytes(24).toString("base64url")}`;
const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");
const displayPrefix = (raw: string) => raw.slice(0, PREFIX_DISPLAY_LEN);

export const createApiKeysService = (props: {
  repository: ApiKeysRepository;
  logger: Logger;
}) => {
  const { repository, logger } = props;

  const list = (workspaceId: string) =>
    repository.listActiveByWorkspace(workspaceId);

  // Returns the persisted row PLUS the raw secret — the only moment it exists
  // in cleartext. Callers must surface it to the operator and then drop it.
  const create = async (data: {
    workspaceId: string;
    organizationId: string;
    name: string;
    createdBy?: string | null;
  }): Promise<{ key: ApiKey; secret: string }> => {
    const secret = generateRawKey();
    const key = await repository.create({
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      name: data.name,
      keyPrefix: displayPrefix(secret),
      keyHash: hashKey(secret),
      createdBy: data.createdBy ?? null,
    });
    logger.info({
      msg: "API key created",
      apiKeyId: key.id,
      workspaceId: data.workspaceId,
    });
    return { key, secret };
  };

  // Revoke only within the owning workspace — a stray id from another workspace
  // must not be revocable.
  const revoke = async (data: { id: string; workspaceId: string }) => {
    const key = await repository.findById(data.id);
    if (!key || key.workspaceId !== data.workspaceId) return false;
    await repository.revoke(data.id);
    logger.info({ msg: "API key revoked", apiKeyId: data.id });
    return true;
  };

  // Resolve a raw bearer key to its (active) row, recording usage. Returns null
  // for unknown/revoked keys so callers can answer 401.
  const verify = async (rawKey: string): Promise<ApiKey | null> => {
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith(RAW_PREFIX)) return null;
    const key = await repository.findActiveByHash(hashKey(trimmed));
    if (!key) return null;
    // Best-effort usage stamp; never block the request on it.
    repository.touchLastUsed(key.id).catch((error) => {
      logger.warn({ msg: "Failed to stamp API key usage", error });
    });
    return key;
  };

  return { list, create, revoke, verify };
};

export type ApiKeysService = ReturnType<typeof createApiKeysService>;
