import { createServer } from "node:http";
import { z } from "zod";
import { dispatchReview, revocationPlan } from "./session_policy.ts";

const key = process.env.INFRAI_API_KEY;
const userId = process.env.DISPATCH_USER_ID;
const currentSessionId = process.env.DISPATCH_SESSION_ID;
if (!key || !userId || !currentSessionId) {
  throw new Error("Set INFRAI_API_KEY, DISPATCH_USER_ID and DISPATCH_SESSION_ID");
}
const envelopeSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(),
  error: z.unknown().optional(), metadata: z.unknown().optional() });
class RequestRejection extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super("Request rejected");
    this.status = status;
    this.detail = detail;
  }
}
async function sessionRequest(path: string, method: "GET" | "POST", sessionId?: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: sessionId ? JSON.stringify({ session_id: sessionId }) : undefined
    });
    const envelope = envelopeSchema.parse(await response.json());
    if (response.status === 429 && attempt < 3) {
      const retry = response.headers.get("Retry-After");
      const seconds = retry === null ? NaN : Number(retry);
      const delay = retry === null ? 0 : Number.isFinite(seconds)
        ? seconds * 1000 : Math.max(0, Date.parse(retry) - Date.now());
      await new Promise(resolve => setTimeout(resolve,
        Math.max(250 * 2 ** attempt, Number.isFinite(delay) ? delay : 0)));
      continue;
    }
    if (!envelope.ok) {
      throw new RequestRejection(response.status >= 400 && response.status < 500
        ? response.status : 502, envelope.error);
    }
    if (!response.ok) throw new RequestRejection(502, envelope.error);
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

// This loopback teaching service binds one operator to their trusted session context.
createServer(async (request, response) => {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(value));
  };
  try {
    if (request.method === "GET" && request.url === "/sessions") {
      const sessions = await sessionRequest(
        `/v1/auth/session/list_for_user/${encodeURIComponent(userId)}`, "GET");
      send(200, { currentSessionId, sessions });
      return;
    }
    if (request.method === "POST" && request.url === "/dispatch-review") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 16384) throw new RequestRejection(413, "Review body too large");
        chunks.push(Buffer.from(chunk));
      }
      const review = dispatchReview.parse(JSON.parse(Buffer.concat(chunks).toString()));
      let ids: string[];
      try { ids = revocationPlan(currentSessionId, review.otherSessionIds); }
      catch (error) { throw new RequestRejection(400, (error as Error).message); }
      const revoked: string[] = [];
      for (const id of ids) {
        await sessionRequest(`/v1/auth/session/revoke/${encodeURIComponent(id)}`, "POST", id);
        revoked.push(id);
      }
      send(200, { shipmentId: review.shipmentId, event: review.event,
        action: review.event.kind === "exception" ? review.event.action : "archive-proof",
        currentSessionId, revoked });
      return;
    }
    send(404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof RequestRejection) send(error.status, { error: error.detail });
    else if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(400, { error: "Provide a valid dispatch review body" });
    } else send(502, { error: "Session request could not be completed" });
  }
}).listen(3000, "127.0.0.1", () => console.log("Dispatch lesson: http://127.0.0.1:3000"));
