import { eq, sql } from "drizzle-orm";

import { createLogger } from "@usercore/logger";
import { generateId, type Plan } from "@usercore/shared-types";

import { member, organization, user } from "../src/db/auth.db";
import { createDB } from "../src/db/db";
import { env } from "../src/env";

// Seeds three admin accounts, each owning one organization at a different
// pricing tier — for testing plan-based gating in the dashboard. Login uses
// the email-OTP flow (no password); the code lands in Mailpit at :8025.
const logger = createLogger({ name: "auth-api-seed-users", level: env.LOG_LEVEL });
const db = createDB({ logger });
const now = new Date();

type Seed = {
  email: string;
  name: string;
  orgName: string;
  orgSlug: string;
  plan: Plan;
};

const SEEDS: Seed[] = [
  {
    email: "admin1@usercore.com",
    name: "Admin One",
    orgName: "Enterprise Org",
    orgSlug: "enterprise-org",
    plan: "ENTERPRISE",
  },
  {
    email: "admin2@usercore.com",
    name: "Admin Two",
    orgName: "Growth Org",
    orgSlug: "growth-org",
    plan: "GROWTH",
  },
  {
    email: "admin3@usercore.com",
    name: "Admin Three",
    orgName: "Starter Org",
    orgSlug: "starter-org",
    plan: "STARTER",
  },
];

// Drop legacy seeds from earlier iterations so re-running converges.
await db
  .delete(organization)
  .where(
    sql`${organization.name} IN ('Starter Test Org', 'Growth Test Org')`,
  );

for (const seed of SEEDS) {
  // 1. User
  const foundUser = await db.query.user.findFirst({
    where: eq(user.email, seed.email),
  });
  let userId: string;
  if (foundUser) {
    userId = foundUser.id;
    logger.info({ msg: "User exists", email: seed.email });
  } else {
    userId = generateId("user");
    await db.insert(user).values({
      id: userId,
      name: seed.name,
      email: seed.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    logger.info({ msg: "User created", email: seed.email });
  }

  // 2. Organization (matched by slug, idempotent)
  const foundOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, seed.orgSlug),
  });
  let orgId: string;
  if (foundOrg) {
    orgId = foundOrg.id;
    await db
      .update(organization)
      .set({ plan: seed.plan })
      .where(eq(organization.id, orgId));
    logger.info({
      msg: "Org exists, plan synced",
      slug: seed.orgSlug,
      plan: seed.plan,
    });
  } else {
    orgId = generateId("org");
    await db.insert(organization).values({
      id: orgId,
      name: seed.orgName,
      slug: seed.orgSlug,
      plan: seed.plan,
      createdAt: now,
    });
    logger.info({
      msg: "Org created",
      slug: seed.orgSlug,
      plan: seed.plan,
    });
  }

  // 3. Membership (owner role).
  const foundMember = await db.query.member.findFirst({
    where: sql`${member.organizationId} = ${orgId} AND ${member.userId} = ${userId}`,
  });
  if (!foundMember) {
    await db.insert(member).values({
      id: generateId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
      createdAt: now,
    });
    logger.info({ msg: "Membership created", email: seed.email });
  }
}

logger.info({ msg: "Seed complete" });
process.exit(0);
