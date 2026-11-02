import test from "node:test";
import assert from "node:assert/strict";
import { dispatchReview, revocationPlan } from "./session_policy.ts";

test("a damaged shipment stays in review while duplicate device selections collapse", () => {
  const review = dispatchReview.parse({ shipmentId: "lesson-42",
    event: { kind: "exception", reason: "damaged", action: "review" },
    otherSessionIds: ["old-tablet", "old-tablet"] });
  assert.deepEqual(revocationPlan("dispatch-desk", review.otherSessionIds), ["old-tablet"]);
  assert.equal(review.event.kind === "exception" && review.event.action, "review");
  assert.throws(() => revocationPlan("dispatch-desk", ["old-tablet", "dispatch-desk"]));
});

test("delivery requires a proof file fingerprint", () => {
  assert.equal(dispatchReview.safeParse({ shipmentId: "lesson-42",
    event: { kind: "delivered", proof: { filename: "signed.pdf", mediaType: "application/pdf" } },
    otherSessionIds: [] }).success, false);
});
