# Firebase API Layer Implementation Plan

## Summary

Build an internal, strongly typed API for the Combat Zone web application:

- Use direct Firebase Authentication and owner-scoped Firestore reads and
  listeners.
- Use type-specific second-generation callable Functions for validated writes.
- Do not add a public REST API, GraphQL, API keys, or a third-party contract.
- Keep the IndexedDB outbox responsible for offline writes and retries.
- Never expose Firebase SDK types outside the cloud adapters.

## Architecture and contracts

Use three focused modules:

- `packages/firebase_api` contains zero-SDK wire types, runtime validators, the
  API version, and stable error codes shared by browser and Functions.
- `functions/src/api` contains callable handlers, authorization, validation,
  Firestore transactions, and error mapping.
- `src/core/persistence/cloud` contains Firebase initialization, callable
  clients, Firestore readers and listeners, retry classification, and domain
  error mapping.

Every mutation uses `apiVersion`, a durable `mutationId`, an expected revision,
and a typed payload. The IndexedDB outbox retains the mutation ID. Each target
record stores the latest mutation ID and server-computed fingerprint so an
identical retry succeeds without applying twice and mismatched reuse is
rejected.

Server timestamps and user IDs always come from trusted Firebase context. API
versions and persisted schema versions are independent and validated
separately.

## Firebase operations

Expose type-specific callable commands for entitlement lookup, workspace
metadata, encounters, encounter deletion, Library state, recovery draft, and
atomic cloud-workspace replacement.

- The authenticated UID determines every Firestore path.
- Client reads and listeners are limited to `users/{uid}` and its public
  subcollections.
- Direct client writes to synchronized records are denied.
- Functions validate unknown input, supported versions, expected revisions,
  and referenced-asset readiness before writing.
- Record and server-derived asset-reference metadata updates commit in the same
  Firestore transaction.
- Full-workspace replacement preflights payload and transaction limits and
  fails without mutation when they cannot be satisfied.
- Conflict-copy construction stays in `CloudSyncCoordinator`; the API returns
  revision conflicts without silently resolving them.

## Errors and operations

Return stable error details containing a code, correlation ID, retryable flag,
and revision details when relevant. Automatically retry only availability,
transport-timeout, and transaction-abort failures using exponential backoff
with full jitter. Validation, authorization, schema, revision, asset-readiness,
size, and idempotency failures require explicit resolution.

Require Firebase Authentication and production App Check for callable writes.
Log endpoint outcomes, correlation IDs, duration, result codes, and retry
counts, but never log record bodies, tokens, image bytes, URLs, filenames, or
user-authored notes. Configure region, timeouts, concurrency, maximum instances,
budget alerts, and usage monitoring centrally.

## Verification

- Unit-test every contract validator, serializer, version rejection, error
  mapping, retry classification, and sensitive-log boundary.
- Test every command for create, update, delete, stale revision, unsupported
  schema, invalid fields, idempotent replay, mismatched replay, missing assets,
  and server failure.
- Use Firebase Emulator coverage for UID isolation, direct-write denial,
  Authentication and App Check enforcement, atomic writes, transaction retries,
  conflict responses, and rejected workspace replacement.
- Verify the IndexedDB outbox retains mutation IDs across refresh, coalesces
  safely, retries transient failures, and does not retry permanent failures.
- Keep object limits, reservations, deletion, and accounting in the
  object-storage test suite.
- Run `npm run test:agent`, the Firebase emulator suite,
  `npm run typecheck`, and `npm run build`.

Local and CI emulator runs require a Java runtime compatible with the pinned
Firebase CLI. Keep that runtime in the development/CI toolchain rather than
adding a Java dependency to the application bundle.

The first API version supports one private workspace per authenticated user and
the first-party React web client only. It does not provide live collaboration,
public API compatibility, native-client compatibility, or Firebase Hosting.
