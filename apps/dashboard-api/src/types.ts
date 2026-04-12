import type { Logger } from "@usercore/logger";

import type { Database } from "./db/db";

export type ContextVariables = {
  logger: Logger;
  db: Database;
};
