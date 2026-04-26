import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";

import { generateId } from "@usercore/shared-types";

import {
  account,
  invitation,
  member,
  organization as organizationTable,
  session,
  user,
  verification,
} from "./db/auth.db";
import type { Database } from "./db/db";
import { env } from "./env";
import type { Mailer } from "./mailer";

const ID_PREFIXES: Record<string, string> = {
  user: "user",
  session: "session",
  account: "account",
  verification: "verification",
  organization: "org",
  member: "member",
  invitation: "invitation",
};

export const createAuth = (props: { db: Database; mailer: Mailer }) => {
  const { db, mailer } = props;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      database: {
        generateId: ({ model }) => generateId(ID_PREFIXES[model] ?? model),
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
        organization: organizationTable,
        member,
        invitation,
      },
    }),
    plugins: [
      emailOTP({
        disableSignUp: true,
        expiresIn: 600,
        sendVerificationOTP: async ({ email, otp }) => {
          await mailer.sendOtpEmail(email, otp);
        },
      }),
      organization({
        allowUserToCreateOrganization: false,
      }),
    ],
    trustedOrigins: ["http://localhost:3000", "http://localhost:3007"],
  });
};

export type Auth = ReturnType<typeof createAuth>;
