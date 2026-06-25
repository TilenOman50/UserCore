import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "http";
import { resolve } from "path";
import { defineConfig, loadEnv, type Connect } from "vite";

// Mock demo: a fictional freelance / gig marketplace ("Workly") integrating
// the UserCore widget for "verify your identity to receive payouts". The Vite
// dev server proxies the secret API key through /api/start-session so it
// never reaches the browser — the same backend-creates-session pattern Stripe
// Checkout, Sumsub, and iDenfy all use.
export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_* vars to the client. The middleware below
  // runs server-side, so we manually load every `.env` value into process.env
  // — that's how USERCORE_API_KEY actually reaches the fetch() call.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), startSessionMiddleware()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    server: { port: 3011, host: true },
  };
});

function startSessionMiddleware() {
  return {
    name: "workly-start-session",
    configureServer(server: { middlewares: Connect.Server }) {
      // GET /api/session-detail?id=<sessionId> — proxies workflows-api so the
      // host can fetch the customer's verified email + name after KYC and
      // register them locally for OTP login.
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next) => {
          if (
            req.method !== "GET" ||
            !req.url ||
            !req.url.startsWith("/api/session-detail")
          ) {
            return next();
          }
          const apiKey = process.env.USERCORE_API_KEY;
          const apiUrl =
            process.env.USERCORE_API_URL ?? "http://localhost:3004";
          if (!apiKey) {
            json(res, 500, { error: "USERCORE_API_KEY is not set." });
            return;
          }
          const url = new URL(req.url, "http://localhost");
          const id = url.searchParams.get("id");
          if (!id) {
            json(res, 400, { error: "Missing ?id=" });
            return;
          }
          try {
            const r = await fetch(
              `${apiUrl}/workflows/workflow-sessions/${encodeURIComponent(id)}`,
              { headers: { Authorization: `Bearer ${apiKey}` } },
            );
            const data = await r.json();
            if (!r.ok) {
              json(res, r.status, data);
              return;
            }
            const attributes = (
              data.attributes as { key: string; value: string }[] | undefined
            )?.reduce<Record<string, string>>((acc, a) => {
              acc[a.key] = a.value;
              return acc;
            }, {});
            json(res, 200, {
              customerId: data.session?.customerId ?? null,
              email: attributes?.["email_verification.email"] ?? null,
              firstName:
                attributes?.["identity_verification.document_first_name"] ??
                null,
              lastName:
                attributes?.["identity_verification.document_last_name"] ??
                null,
              status: data.session?.status ?? null,
            });
          } catch (err) {
            json(res, 502, {
              error: `Could not reach UserCore API: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        },
      );

      // GET /api/check-email?email=<address> — workspace-scoped lookup so
      // the host's login flow can verify the address actually belongs to a
      // KYC'd customer in this workspace before sending an OTP.
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next) => {
          if (
            req.method !== "GET" ||
            !req.url ||
            !req.url.startsWith("/api/check-email")
          ) {
            return next();
          }
          const apiKey = process.env.USERCORE_API_KEY;
          const apiUrl =
            process.env.USERCORE_API_URL ?? "http://localhost:3004";
          if (!apiKey) {
            json(res, 500, { error: "USERCORE_API_KEY is not set." });
            return;
          }
          const url = new URL(req.url, "http://localhost");
          const email = url.searchParams.get("email");
          if (!email) {
            json(res, 400, { error: "Missing ?email=" });
            return;
          }
          try {
            const r = await fetch(
              `${apiUrl}/workflows/workflow-sessions/find-by-email?email=${encodeURIComponent(email)}`,
              { headers: { Authorization: `Bearer ${apiKey}` } },
            );
            const data = await r.json();
            json(res, r.status, data);
          } catch (err) {
            json(res, 502, {
              error: `Could not reach UserCore API: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        },
      );

      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next) => {
          if (req.method !== "POST" || req.url !== "/api/start-session") {
            return next();
          }
          const apiKey = process.env.USERCORE_API_KEY;
          const apiUrl =
            process.env.USERCORE_API_URL ?? "http://localhost:3004";
          const workflowId = process.env.USERCORE_WORKFLOW_ID; // optional → server picks workspace default
          if (!apiKey) {
            json(res, 500, {
              error:
                "USERCORE_API_KEY is not set on the Workly mock site. Copy .env.example to .env and paste a key from the dashboard.",
            });
            return;
          }
          let body = "";
          for await (const chunk of req) body += chunk;
          const data = body ? safeJson(body) : {};
          const customerId =
            data.customerId ??
            `cust_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          const externalSessionId = `${customerId}_${Date.now()}`;
          try {
            const r = await fetch(`${apiUrl}/workflows/workflow-sessions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                externalSessionId,
                externalSessionSource: "widget",
                customerId,
                ...(workflowId ? { workflowId } : {}),
              }),
            });
            const result = await r.json();
            if (!r.ok) {
              json(res, r.status, {
                error: result.error ?? "Failed to start session",
              });
              return;
            }
            json(res, 200, {
              sessionId: result.id,
              customerId,
              mobileUrl: result.mobileUrl ?? null,
            });
          } catch (err) {
            json(res, 502, {
              error: `Could not reach UserCore API at ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        },
      );
    },
  };
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

const safeJson = (s: string): Record<string, string> => {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};
