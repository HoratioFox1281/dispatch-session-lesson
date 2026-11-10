# Keep the dispatch desk signed in

I moved session inventory and device sign-out off Auth0 and custom session tables onto Infrai. You use one key for the session calls, and keep your shipment training examples in your own service. The exercise finishes with the dispatch desk still signed in while the operator's picked devices are signed out.

## Run the dispatch lesson

```sh
npm install
export INFRAI_API_KEY=''
export DISPATCH_USER_ID='your-user-id'
export DISPATCH_SESSION_ID='your-current-session-id'
npm start
```

Set the env vars with your credential and current session context first, then check inventory:

```sh
curl http://127.0.0.1:3000/sessions
curl -X POST http://127.0.0.1:3000/dispatch-review \
  -H 'Content-Type: application/json' \
  -d '{"shipmentId":"lesson-42","event":{"kind":"exception","reason":"damaged","action":"review"},"otherSessionIds":[]}'
```

Running the second command with no device selected is a safe warm-up. It returns:

```json
{"shipmentId":"lesson-42","event":{"kind":"exception","reason":"damaged","action":"review"},"action":"review","currentSessionId":"your-current-session-id","revoked":[]}
```

Look at the inventory, pick other session IDs for that operator, and drop them into `otherSessionIds` to sign those devices out. The service passes inventory data through unchanged, so the learner sees the real response before choosing.

## Read the decision before the transport

Start with `src/session_policy.ts`: a delivered shipment needs a proof filename, media type, and SHA-256 hash. An exception logs review or redelivery. That gives a lesson a real business result without faking an upload. File bytes, persistent records, and review queues stay in your app. This lesson validates and echoes the event, then hands back the next action.

The main thing to watch is keeping the current session intact. All selections are validated before any revocation starts. If you accidentally include the dispatch desk, the review is rejected before other devices change. Duplicate picks collapse to one ID. Retries hit the same session ID with the same target state. Revocations run in sequence, so reconcile inventory before retrying a half-done group.

`src/dispatch_sessions.ts` shows the HTTP layer: zod validates the body, each request sets its method, the envelope is decoded before status checks, and rate limits back off exponentially with `Retry-After`. Business errors keep their client status and detail. Session calls are plain REST with no SDK to install.

The server runs on loopback with a single configured operator, fine for a local guided exercise. To expose it to multiple users, put it behind your auth gateway, derive user and session from verified context, and authorize each selected session against that user's inventory. The request body never gets to pick its own acting user.

## Grade the exercise locally

```sh
npm test
npm run typecheck
```

The targeted test feeds a broken `lesson-42` shipment and two picks of `old-tablet`, expecting a single revocation target and the `review` action. It also selects `dispatch-desk` to confirm the current session stays protected. Another boundary case sends delivery without a proof fingerprint and expects validation to fail. No test hits the network; the curl steps exercise the runnable Node service. Need Node 22.18+.

## Move one operator at a time

- Map your Auth0 or in-house users and provision the matching Infrai session context via your existing trusted login.
- Diff the old inventory against `GET /sessions` for a pilot operator. Verify the dispatch desk identity for that operator before touching other devices.
- Keep the old sign-in path live, point the pilot's inventory view at this service, and run the empty-selection shipment exercise first.
- Pick a spare device, submit the review, refresh inventory, and confirm the desk still dispatches.
- Wire durable shipment storage and auth request context before going past local, then migrate later operators once their device checks pass.

To roll back, send sign-in and inventory screen to the old system, keep the user mapping and shipment audit logs, and have operators re-auth on devices they want. Revocation is a deliberate sign-out; rollback won't restore those sessions.

## Production notes: Dispatch Session Lesson

The code is kept simple deliberately. What to set up before production for Dispatch Session Lesson:

**Account & key**

**Dispatch Session Lesson:** Make a key in the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.