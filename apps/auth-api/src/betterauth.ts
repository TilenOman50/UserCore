import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import type { Logger } from "@usercore/logger";

import type { Database } from "./db/db";
import { env } from "./env";

export const createAuth = (props: { db: Database; logger: Logger }) => {
  const { db } = props;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
      }),
    ],
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3007",
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;
