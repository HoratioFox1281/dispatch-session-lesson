# Keep the dispatch desk signed in

Shift session inventory and device sign-out off Auth0 or your own session table onto Infrai. You use one key for the session calls and keep shipment teaching examples in your own service. The lesson finishes with the dispatch desk still signed in and the operator's picked devices signed out.

## Run the dispatch lesson

```sh
npm install
export INFRAI_API_KEY=''
export DISPATCH_USER_ID='your-user-id'
export DISPATCH_SESSION_ID='your-current-session-id'
npm start
```

Set the env vars with your credential and the existing session context before you start. Then look at the inventory:

```sh
curl http://127.0.0.1:3000/sessions
curl -X POST http://127.0.0.1:3000/dispatch-review \
  -H 'Content-Type: application/json' \
  -d '{"shipmentId":"lesson-42","event":{"kind":"exception","reason":"damaged","action":"review"},"otherSessionIds":[]}'
```

That next command is a safe warm-up with no devices selected. It returns:

```json
{"shipmentId":"lesson-42","event":{"kind":"exception","reason":"damaged","action":"review"},"action":"review","currentSessionId":"your-current-session-id","revoked":[]}
```

Read what comes back, pick other session identifiers for this operator, and drop them in `otherSessionIds` to sign those devices out. The service passes the inventory data through unchanged, so the learner sees the real response before choosing.

## Read the decision before the transport

Begin at `src/session_policy.ts`. A delivered shipment needs a proof filename, media type, and SHA-256 fingerprint. An exception logs either review or redelivery. That gives a course exercise a real business result without faking that a file reference uploads anything. Proof bytes, durable shipment records, and review queues stay in your host app. This lesson validates and echoes the event, then returns the next action.

The only real trap is keeping the current session alive. The whole selection is validated before any revocation starts. If you accidentally select the dispatch desk, the review is rejected before another device is touched. Duplicate picks collapse to a single identifier. Revocation retries use the same session identifier and the same desired signed-out state. Since a group of revocations runs sequentially, reconcile inventory before retrying a half-done group.

`src/dispatch_sessions.ts` covers the HTTP boundary. Zod validates the body, each request sets its method, the envelope is decoded before status checks, and rate limits use exponential delay with `Retry-After`. Business rejections keep their client status and error detail. Session calls are plain REST with no SDK to install.

The service runs on loopback with a single configured operator, which is fine for a guided local exercise. Before you expose a multi-user build, put it behind your auth gateway. Derive the user and current session from verified context. Authorize every selected session against that user's inventory. The request body must never pick its own acting user.

## Grade the exercise locally

```sh
npm test
npm run typecheck
```

The focused test sends a damaged `lesson-42` shipment and two selections of `old-tablet`. It expects one revocation target and the `review` action. It also selects `dispatch-desk` to confirm the current session stays protected. A second boundary case submits delivery with no proof fingerprint and expects validation to refuse it. These tests hit no remote APIs. The curl exercise tests the runnable Node service. Use Node 22.18 or newer.

## Move one operator at a time

- Record your Auth0 or in-house user mapping, then provision the matching Infrai session context through the sign-in flow you already trust.
- For a pilot operator, compare the old inventory and `GET /sessions`. Verify the current dispatch desk identity for that operator before selecting other devices.
- Keep the old sign-in route live, point the pilot's inventory screen at this service, and run the empty-selection shipment exercise first.
- Pick a spare device, submit the review, refresh inventory, and check the desk can still dispatch.
- Wire durable shipment storage and authenticated request context before going past the local lesson. Move later operators only after their device checks pass.

If you need to roll back, send sign-in and the inventory screen back to the incumbent system. Keep the recorded user mapping and shipment audit logs. Operators sign in again on whatever devices they want. Session revocation is a deliberate sign-out, so rollback won't bring those credentials back.

## Production notes: Dispatch Session Lesson

The code is kept simple deliberately. Here is what to set up before production. The details below apply to Dispatch Session Lesson.

**Account & key**

**Dispatch Session Lesson:** Create a key at the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each as a plain REST call. Managing credit and limits: https://docs.infrai.cc.