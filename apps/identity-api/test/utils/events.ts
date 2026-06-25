// Shared event-firing helpers for the in-process rabbit fake. The
// KycCompletedPayload schema requires reviewedAt + reviewedBy in addition to
// the obvious identity fields. Tests always set them so a missing one means
// we actually want to test the validation path.

import type { TestApp } from "./testApp";

export const fireKycCompleted = (
  rabbit: TestApp["rabbit"],
  payload: Record<string, unknown>,
) =>
  rabbit.trigger("usercore.events", "kyc.completed", {
    reviewedAt: new Date().toISOString(),
    reviewedBy: "reviewer_test",
    ...payload,
  });
