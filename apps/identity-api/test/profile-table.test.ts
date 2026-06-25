// Paginated + filtered customers table — GET /profiles/workspace/:id/table.
// Seeds a fixed cohort and asserts each filter dimension in isolation, plus
// pagination + workspace scoping.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CustomerRiskLevel, KycStatus } from "@usercore/shared-types";

import { fireKycCompleted } from "./utils/events";
import { bootTestApp, type TestApp } from "./utils/testApp";

type Seed = {
  customerId: string;
  workspaceId: string;
  status: KycStatus;
  riskLevel?: CustomerRiskLevel;
  firstName: string;
  lastName: string;
  country: string;
};

// 15 customers in ws_main spanning all three statuses, all three risk levels,
// and three countries. Names are unique so the search test can target them.
const COHORT: Seed[] = [
  { customerId: "cust_01", workspaceId: "ws_main", status: "approved", riskLevel: "low",    firstName: "Marko",  lastName: "Novak",   country: "SVN" },
  { customerId: "cust_02", workspaceId: "ws_main", status: "approved", riskLevel: "low",    firstName: "Janez",  lastName: "Kovač",   country: "SVN" },
  { customerId: "cust_03", workspaceId: "ws_main", status: "approved", riskLevel: "medium", firstName: "Hans",   lastName: "Schmidt", country: "DEU" },
  { customerId: "cust_04", workspaceId: "ws_main", status: "approved", riskLevel: "high",   firstName: "Petra",  lastName: "Weber",   country: "DEU" },
  { customerId: "cust_05", workspaceId: "ws_main", status: "approved", riskLevel: "medium", firstName: "Lisa",   lastName: "Brown",   country: "USA" },
  { customerId: "cust_06", workspaceId: "ws_main", status: "rejected", riskLevel: "high",   firstName: "Tom",    lastName: "Smith",   country: "USA" },
  { customerId: "cust_07", workspaceId: "ws_main", status: "rejected", riskLevel: "high",   firstName: "Klaus",  lastName: "Mueller", country: "DEU" },
  { customerId: "cust_08", workspaceId: "ws_main", status: "rejected", riskLevel: "medium", firstName: "Sara",   lastName: "Jones",   country: "USA" },
  { customerId: "cust_09", workspaceId: "ws_main", status: "pending",  riskLevel: "low",    firstName: "Eva",    lastName: "Horvat",  country: "SVN" },
  { customerId: "cust_10", workspaceId: "ws_main", status: "pending",  riskLevel: "low",    firstName: "Anna",   lastName: "Fischer", country: "DEU" },
  { customerId: "cust_11", workspaceId: "ws_main", status: "pending",  riskLevel: "medium", firstName: "Mike",   lastName: "Davis",   country: "USA" },
  { customerId: "cust_12", workspaceId: "ws_main", status: "flagged",  riskLevel: "high",   firstName: "Ivan",   lastName: "Krajnc",  country: "SVN" },
  { customerId: "cust_13", workspaceId: "ws_main", status: "flagged",  riskLevel: "high",   firstName: "Greta",  lastName: "Wagner",  country: "DEU" },
  { customerId: "cust_14", workspaceId: "ws_main", status: "approved", riskLevel: "low",    firstName: "Mojca",  lastName: "Petek",   country: "SVN" },
  { customerId: "cust_15", workspaceId: "ws_main", status: "approved", riskLevel: "low",    firstName: "Luka",   lastName: "Zupan",   country: "SVN" },
];

const seedCohort = async (ctx: TestApp) => {
  let i = 0;
  for (const c of COHORT) {
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: `seed_${i++}`,
      customerId: c.customerId,
      workspaceId: c.workspaceId,
      status: c.status,
      riskLevel: c.riskLevel,
      firstName: c.firstName,
      lastName: c.lastName,
      country: c.country,
    });
  }
};

describe("GET /identity/profiles/workspace/:workspaceId/table", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
    await seedCohort(ctx);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("no filters → returns total + first page (default limit 20)", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(15);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(body.items).toHaveLength(15);
  });

  test("page=2&limit=5 → offset 5 onwards, totalPages reflects the cohort size", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?page=2&limit=5",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(15);
    expect(body.page).toBe(2);
    // ceil(15 / 5) = 3
    expect(body.totalPages).toBe(3);
    expect(body.items).toHaveLength(5);
  });

  test("status=approved → only approved rows", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?status=approved",
    );
    const body = await res.json();
    // 7 approved customers in the cohort
    expect(body.total).toBe(7);
    expect(
      body.items.every((r: { kycStatus: string }) => r.kycStatus === "approved"),
    ).toBe(true);
  });

  test("riskLevel=high → only high-risk rows", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?riskLevel=high",
    );
    const body = await res.json();
    // 5 high-risk customers (04, 06, 07, 12, 13)
    expect(body.total).toBe(5);
    expect(
      body.items.every((r: { riskLevel: string }) => r.riskLevel === "high"),
    ).toBe(true);
  });

  test("country=SVN → only Slovenian customers", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?country=SVN",
    );
    const body = await res.json();
    // 6 SVN customers (01, 02, 09, 12, 14, 15)
    expect(body.total).toBe(6);
    expect(
      body.items.every((r: { country: string }) => r.country === "SVN"),
    ).toBe(true);
  });

  test("combined status+riskLevel+country filter (intersection)", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?status=approved&riskLevel=low&country=SVN",
    );
    const body = await res.json();
    // approved + low + SVN = cust_01, cust_02, cust_14, cust_15 → 4 rows
    expect(body.total).toBe(4);
    const ids = body.items.map((r: { customerId: string }) => r.customerId);
    expect(ids.sort()).toEqual(["cust_01", "cust_02", "cust_14", "cust_15"]);
  });

  test("search=Marko matches firstName, lastName, or customerId substrings", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?search=Marko",
    );
    const body = await res.json();
    // Only cust_01 has firstName "Marko"
    expect(body.total).toBe(1);
    expect(body.items[0].customerId).toBe("cust_01");

    // customerId substring search — every cust_XX matches
    const idSearch = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?search=cust_0",
    );
    const idBody = await idSearch.json();
    // cust_01 through cust_09 → 9 matches
    expect(idBody.total).toBe(9);
  });

  test("archived=true returns only archived rows; default excludes them", async () => {
    // Archive cust_01 directly
    await ctx.request("/identity/profiles/customer/cust_01/archive", {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });

    const defaultRes = await ctx.request(
      "/identity/profiles/workspace/ws_main/table",
    );
    const defaultBody = await defaultRes.json();
    // 15 − 1 archived = 14
    expect(defaultBody.total).toBe(14);
    expect(
      defaultBody.items.every(
        (r: { customerId: string }) => r.customerId !== "cust_01",
      ),
    ).toBe(true);

    const archivedRes = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?archived=true",
    );
    const archivedBody = await archivedRes.json();
    expect(archivedBody.total).toBe(1);
    expect(archivedBody.items[0].customerId).toBe("cust_01");
    expect(archivedBody.items[0].archivedAt).not.toBeNull();
  });

  test("workspace isolation — ws_other customers don't appear in ws_main", async () => {
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "noise_session",
      customerId: "cust_other",
      workspaceId: "ws_other",
      status: "approved",
      riskLevel: "low",
      firstName: "Other",
      lastName: "Workspace",
      country: "SVN",
    });

    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/table?status=approved",
    );
    const body = await res.json();
    // Still 7 approved in ws_main; ws_other is not counted.
    expect(body.total).toBe(7);
    expect(
      body.items.every(
        (r: { customerId: string }) => r.customerId !== "cust_other",
      ),
    ).toBe(true);
  });
});
