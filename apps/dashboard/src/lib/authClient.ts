import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3001",
  plugins: [emailOTPClient(), organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
