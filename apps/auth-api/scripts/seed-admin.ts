import { eq } from "drizzle-orm";

import { createLogger } from "@usercore/logger";
import { generateId } from "@usercore/shared-types";

import { member, organization, user } from "../src/db/auth.db";
import { createDB } from "../src/db/db";
import { WorkspaceTable } from "../src/db/schema.db";
import { env } from "../src/env";

const logger = createLogger({ name: "auth-api-seed", level: env.LOG_LEVEL });

const email = (process.argv[2] ?? "").trim().toLowerCase();
const name = (process.argv[3] ?? "Admin").trim();
const orgName = (process.argv[4] ?? "UserCore").trim();
const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

if (!email) {
  console.error(
    "Usage: bun scripts/seed-admin.ts <email> [name] [organization-name]",
  );
  process.exit(1);
}

const db = createDB({ logger });
const now = new Date();

// 1. User
const foundUser = await db.query.user.findFirst({
  where: eq(user.email, email),
});
let userId: string;
if (foundUser) {
  userId = foundUser.id;
  logger.info({ msg: "User already exists", userId, email });
} else {
  userId = generateId("user");
  await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  logger.info({ msg: "User created", userId, email });
}

// 2. Organization (matched by slug)
const foundOrg = await db.query.organization.findFirst({
  where: eq(organization.slug, orgSlug),
});
let orgId: string;
if (foundOrg) {
  orgId = foundOrg.id;
  logger.info({ msg: "Organization already exists", orgId });
} else {
  orgId = generateId("org");
  await db.insert(organization).values({
    id: orgId,
    name: orgName,
    slug: orgSlug,
    createdAt: now,
  });
  logger.info({ msg: "Organization created", orgId, slug: orgSlug });
}

// 3. Member link (user -> org as owner)
const foundMember = await db.query.member.findFirst({
  where: eq(member.userId, userId),
});
if (foundMember) {
  logger.info({ msg: "Member already exists" });
} else {
  await db.insert(member).values({
    id: generateId("member"),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: now,
  });
  logger.info({ msg: "Member added as owner" });
}

// 4. Workspace (one per org)
const foundWorkspace = await db.query.WorkspaceTable.findFirst({
  where: eq(WorkspaceTable.organizationId, orgId),
});
if (foundWorkspace) {
  logger.info({
    msg: "Workspace already exists",
    workspaceId: foundWorkspace.id,
  });
} else {
  const workspaceId = generateId("workspace");
  await db.insert(WorkspaceTable).values({
    id: workspaceId,
    name: orgName,
    slug: orgSlug,
    organizationId: orgId,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  });
  logger.info({ msg: "Workspace created", workspaceId });
}

logger.info({
  msg: "Seed complete",
  email,
  userId,
  organizationId: orgId,
});

process.exit(0);
