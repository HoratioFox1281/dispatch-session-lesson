import { z } from "zod";

export const dispatchReview = z.object({
  shipmentId: z.string().min(1),
  event: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("delivered"), proof: z.object({
      filename: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/),
      mediaType: z.enum(["image/jpeg", "application/pdf"])
    }).strict() }).strict(),
    z.object({ kind: z.literal("exception"), reason: z.enum(["damaged", "recipient_absent"]),
      action: z.enum(["review", "redeliver"]) }).strict()
  ]),
  otherSessionIds: z.array(z.string().min(1)).max(20)
}).strict();

export function revocationPlan(currentSessionId: string, requested: string[]): string[] {
  if (requested.includes(currentSessionId)) {
    throw new Error("Keep the current dispatch session selected as current");
  }
  return Array.from(new Set(requested));
}
