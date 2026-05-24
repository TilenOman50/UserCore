import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { Logger } from "@usercore/logger";

import { env } from "../env";

export const createStorageService = (props: { logger: Logger }) => {
  const { logger } = props;

  const client = new S3Client({
    endpoint: env.MINIO_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
  });

  const uploadFile = async (props: {
    key: string;
    body: Buffer | Uint8Array;
    mimeType: string;
  }) => {
    await client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: props.key,
        Body: props.body,
        ContentType: props.mimeType,
      }),
    );
    logger.info({ msg: "File uploaded to MinIO", key: props.key });
    return props.key;
  };

  // Object metadata (content type + byte size) without downloading the body.
  // Used to label the reviewer's image viewer. Best-effort: a failed head
  // shouldn't break rendering the image, so callers get nulls on error.
  const headFile = async (key: string) => {
    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
      );
      return {
        contentType: res.ContentType ?? null,
        size: typeof res.ContentLength === "number" ? res.ContentLength : null,
      };
    } catch (err) {
      logger.warn({ msg: "headFile failed", key, err });
      return { contentType: null, size: null };
    }
  };

  const getSignedDownloadUrl = async (key: string, expiresInSeconds = 3600) => {
    const command = new GetObjectCommand({
      Bucket: env.MINIO_BUCKET,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  };

  // Fetch object bytes directly. Used when the consumer can't reach MinIO
  // directly — e.g. the widget on a phone during a QR handoff, where the
  // dev-time presigned URL points at localhost:9000.
  const getObject = async (key: string) => {
    const res = await client.send(
      new GetObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return {
      body: bytes,
      contentType: res.ContentType ?? "application/octet-stream",
    };
  };

  return { uploadFile, getSignedDownloadUrl, getObject, headFile };
};

export type StorageService = ReturnType<typeof createStorageService>;
