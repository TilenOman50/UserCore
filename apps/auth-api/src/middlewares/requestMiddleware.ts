import type { MiddlewareHandler } from "hono";

import type { Logger } from "@usercore/logger";

import type { Database } from "../db/db";
import type { ContextVariables } from "../types";

export const createRequestMiddleware = (props: {
  db: Database;
  logger: Logger;
}): MiddlewareHandler<{ Variables: ContextVariables }> => {
  return async (c, next) => {
    c.set("db", props.db);
    c.set("logger", props.logger);
    await next();
  };
};
