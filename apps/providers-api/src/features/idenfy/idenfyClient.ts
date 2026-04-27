import type { Logger } from "@usercore/logger";

import type { env as Env } from "../../env";

// Real iDenfy session-creation request shape per their public API. Without
// API_KEY/API_SECRET in env this call returns 401 — the surrounding code is
// real, only the credentials are missing.
//
// POST {IDENFY_BASE_URL}/api/v2/token
// Auth: Basic base64(API_KEY:API_SECRET)
// Returns: { authToken, scanRef, expiryTime }
export type IdenfyStartSessionInput = {
  clientId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  documentTypes?: Array<
    "ID_CARD" | "PASSPORT" | "RESIDENCE_PERMIT" | "DRIVER_LICENSE"
  >;
  callbackUrl?: string;
  successUrl?: string;
  errorUrl?: string;
  locale?: string;
};

export type IdenfyStartSessionOutput = {
  authToken: string;
  scanRef: string;
  expiryTime: number;
  scanUrl: string;
};

export const createIdenfyClient = (props: {
  env: Pick<
    typeof Env,
    "IDENFY_API_KEY" | "IDENFY_API_SECRET" | "IDENFY_BASE_URL"
  >;
  logger: Logger;
}) => {
  const { env, logger } = props;

  const startSession = async (
    input: IdenfyStartSessionInput,
  ): Promise<IdenfyStartSessionOutput> => {
    if (!env.IDENFY_API_KEY || !env.IDENFY_API_SECRET) {
      throw new Error(
        "iDenfy credentials missing (IDENFY_API_KEY/IDENFY_API_SECRET)",
      );
    }
    const auth = Buffer.from(
      `${env.IDENFY_API_KEY}:${env.IDENFY_API_SECRET}`,
    ).toString("base64");
    const res = await fetch(`${env.IDENFY_BASE_URL}/api/v2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({
        msg: "iDenfy token request failed",
        status: res.status,
        body,
      });
      throw new Error(`iDenfy token request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      authToken: string;
      scanRef: string;
      expiryTime: number;
    };
    return {
      ...data,
      scanUrl: `https://ui.idenfy.com/?authToken=${data.authToken}`,
    };
  };

  return { startSession };
};

export type IdenfyClient = ReturnType<typeof createIdenfyClient>;
