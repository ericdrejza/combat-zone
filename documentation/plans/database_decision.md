# Firebase Backend and Database Architecture Decision

Implementation is planned in
[`database_implementation.md`](./database_implementation.md).
Uploaded bytes, storage limits, and object lifecycle are planned separately in
[`object_storage_implementation.md`](./object_storage_implementation.md).

## Status and decision summary

This document records the backend and database decision after reopening the
existing NoSQL choice and evaluating both the MVP and the optional cloud-sync
phase.

- Use a non-relational, document-oriented logical model.
- Keep IndexedDB as the authoritative local database.
- Use Firebase as the managed cloud-backend platform, with Cloud Firestore as
  its primary cloud database.
- Use Firebase Authentication, Cloud Functions, Cloud Storage, App Check, and
  the Local Emulator Suite around Firestore where their focused responsibilities
  require them.
- Do not replace Firestore with Firebase Realtime Database.
- Do not decompose encounter entities into relational tables or introduce
  browser-hosted SQLite for the current product requirements.
- Keep all storage engines behind `WorkspaceRepository` so this decision can be
  revisited without coupling Redux or UI code to IndexedDB or Firebase.

This reaffirms the current implementation. It does not require a runtime data
migration, dependency change, or public API change.

## Decision drivers

The database must support the following existing product and architecture
contracts:

- The application is local-first and must remain usable without a server or an
  internet connection.
- An encounter is edited, validated, imported, exported, and restored as a
  complete, versioned `EncounterState` snapshot.
- Undo and redo are session-only Redux concerns. Only `encounter.present` is
  durable.
- Persisted data uses stable IDs, normalized `byId` / `allIds` collections,
  explicit schema versions, and application-owned validation and migrations.
- Encounter writes use optimistic revision checks. Workspace imports require
  local atomicity, with a recoverable backup before overwrite.
- The MVP permits one editing browser tab at a time. Optional cloud sync adds
  backup and multi-device synchronization, not live multi-user collaboration.
- Images can be substantially larger than encounter metadata and require
  separate binary/object storage in the cloud.
- The current workload is one logical workspace containing a small number of
  encounters, each with dozens rather than thousands of entities. There is no
  current requirement for cross-workspace reporting, ad hoc relational joins,
  or a public query API.

## Options considered

| Option | Strengths | Costs and mismatches | Decision |
| --- | --- | --- | --- |
| IndexedDB with versioned documents | Browser-native, offline, transactional, stores structured objects directly, and matches the repository's aggregate operations | Application code owns validation, migrations, and reference integrity | Selected for local persistence |
| SQLite/WASM with relational tables | SQL queries, constraints, and mature relational transactions | Adds WASM, worker, OPFS, CSP, browser-compatibility, and relational mapping complexity without a present SQL query need | Rejected for the current local application |
| Firebase platform with Cloud Firestore | Document model matches encounter aggregates; Authentication, Functions, App Check, Security Rules, emulators, and managed object storage reduce operational work for a solo developer | Vendor-specific APIs, operation-based costs, a strict document-size limit, and transactions that cannot commit offline | Selected for optional cloud sync |
| Firebase Realtime Database | Very low-latency synchronization, presence support, and simple JSON storage | One large JSON tree, more denormalization, more limited queries, subtree-scoped transactions, and no web offline persistence; these do not match versioned encounter documents | Rejected as the primary cloud database |
| Managed PostgreSQL with object storage | Strong relational constraints, flexible reporting, JSONB, and an established path to analytics and integrations | Requires a new hosted data model and synchronization/API layer; relational decomposition conflicts with aggregate snapshot writes, while JSONB would retain the document model anyway | Deferred unless reassessment triggers occur |

IndexedDB is a transactional database of keyed structured values and supports
indexes when new local lookup requirements arise. Its native data model avoids
translating every `EncounterState` commit into many row-level writes. See the
[Indexed Database API specification](https://www.w3.org/TR/IndexedDB/).

SQLite/WASM is technically viable in modern browsers, but persistent OPFS
access runs in a worker and its available VFS choices have different portability
and multi-connection tradeoffs. Those costs do not buy a product capability the
MVP currently needs. See SQLite's
[WASM overview](https://www.sqlite.org/wasm/doc/trunk/about.md) and
[persistent storage options](https://www.sqlite.org/wasm/doc/trunk/persistence.md).

Firebase is the selected managed backend platform rather than an alternative to
Firestore. Firestore is the Firebase database that stores versioned cloud
documents; Authentication owns identity, Functions own privileged operations,
Cloud Storage owns uploaded bytes, App Check provides client attestation, and
the Emulator Suite supports local integration testing. Firebase Hosting is an
optional future deployment target and is not required by this decision.

Firestore is explicitly a NoSQL document database whose documents contain
nested maps and arrays, which closely matches the application's versioned JSON
state. See the official [Firestore data model](https://firebase.google.com/docs/firestore/data-model).
It also supports atomic transactions, although online transactions fail while
offline; offline changes therefore remain the responsibility of the existing
IndexedDB-backed sync queue rather than a replacement local source of truth.
See [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
and [offline behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

Firebase recommends Firestore for new applications with rich data models and
describes Realtime Database as better suited to simpler models and very
low-latency synchronization. Combat Zone needs structured, independently
versioned records and does not require presence or continuous shared-state
streaming. See Firebase's
[database comparison](https://firebase.google.com/docs/database/rtdb-vs-firestore).

PostgreSQL remains a credible future alternative. Its JSONB support could store
complete encounter aggregates while also enabling indexed server-side queries.
That would be a hybrid physical implementation of the same document-oriented
logical model, not a reason to split zones, actors, engagements, edges, and
annotations into authoritative relational rows today. See
[PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html).

## Chosen logical model

Persist records at the consistency boundaries already defined by
`WorkspaceRepository`:

- One workspace manifest with schema version, active encounter ID, revision,
  and update timestamp.
- One record per saved encounter, containing the complete versioned
  `EncounterState`, folder association, revision, and timestamps.
- At most one unfiled recovery-draft record.
- One versioned Library record.
- Recoverable pre-import backups.

Within an encounter document, domain entities remain normalized by ID. The
document database choice does not authorize denormalizing relationships or
duplicating persisted facts. Relationships continue to have one authoritative
owner and are resolved through selectors and inspectors.

Persisting the encounter as an aggregate preserves the application's actual
write and consistency model:

1. An interaction prepares and validates a complete next `EncounterState`.
2. Redux history commits that state atomically in memory.
3. Autosave writes `encounter.present` as one revision-checked encounter record.
4. Loading validates and migrates the whole record before creating fresh Redux
   history around it.

Relational entity tables would require reconstructing the same aggregate on
every load and coordinating many row updates for each history commit. Database
foreign keys could enforce some references, but they would not replace the
domain validators, layout invariants, cascade behavior, exact snapshot history,
or validation-mode rules already owned by the application.

## Storage topology

### Local MVP

IndexedDB remains divided by responsibility into manifest, encounter, recovery,
Library, and backup object stores. Cross-record operations such as workspace
import use a single IndexedDB transaction. Raw database requests remain private
to the adapter.

The following remain session-only and must not be persisted in either database
family:

- Redux `past` and `future` history.
- Action logs and interaction drafts.
- Viewport state, layout caches, route caches, and derived render geometry.

### Optional Firebase backend and cloud sync

Firestore stores versioned workspace and encounter documents. Firebase Cloud
Storage stores image bytes uploaded into the application, while Google
Drive-linked and ordinary HTTP(S) assets remain in their external source.
Firestore records contain stable asset references and metadata rather than
embedded data URLs. Cloud Storage is designed for user-generated binary
content such as images and video. See
[Cloud Storage for Firebase](https://firebase.google.com/docs/storage/web/start).
All upload limits, usage accounting, deduplication, and object lifecycle
decisions belong to the object-storage implementation plan rather than the
database implementation plan.

This separation is mandatory because a Firestore document must remain below
its documented limit of 1 MiB minus 4 bytes. Before implementing cloud sync,
representative asset-free encounter fixtures must be serialized and checked
against that limit with room for supported schema evolution. See the
[Firestore document resource limits](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents).

The sync coordinator sits above `WorkspaceRepository` and is the only
application-level component that communicates with Firebase adapters. Its
responsibilities include:

- Coalescing local changes rather than mirroring the 500ms autosave cadence
  directly into unnecessary remote writes.
- Comparing expected document revisions in remote transactions.
- Queuing offline changes in IndexedDB and retrying after reconnection.
- Creating a clearly named conflict-copy encounter when two devices change the
  same encounter independently.
- Applying authentication and security rules so users can access only their
  own manifests, encounters, and assets.

Redux and UI modules must not write directly to Firestore or Cloud Storage.
Firestore's optional client cache is never authoritative and must not bypass
the repository, migration, revision, import, or writer-boundary contracts.
App Check complements Firebase Authentication and Security Rules but does not
replace either authorization mechanism.

## Schema evolution and integrity

The application continues to own persistence compatibility across all adapters:

- Every encounter, workspace record, Library record, and export envelope has an
  explicit schema version.
- Reads validate and migrate supported older data before it reaches Redux.
- Unsupported newer versions and corrupt data are rejected without replacing
  the last valid local state.
- Stable IDs remain authoritative; names need not be unique.
- Revision conflicts never silently overwrite another saved version.
- Multi-record imports validate completely before local mutation, and overwrite
  imports create a recoverable backup first.

Database object-store or remote collection migrations and domain-document
migrations are distinct. Changing an IndexedDB store layout or remote provider
schema must not silently change the `EncounterState` contract.

## Reassessment triggers

Reopen this decision when a concrete requirement or measurement establishes
one of the following:

- Representative asset-free encounter documents cannot fit safely within the
  Firestore document limit.
- Users need cross-workspace reporting, indexed search over entity properties,
  or integrations that require relational access.
- Live multi-user collaboration requires fine-grained concurrent entity writes
  instead of revisioned encounter aggregates and conflict copies.
- Measured Firestore write cost, contention, latency, regional, compliance, or
  operational requirements make it unsuitable.
- Measured Firebase platform cost, service coupling, availability, or
  operational limitations outweigh the benefit of its managed integration.
- The volume of workspace records makes document scans or application-owned
  reference validation a demonstrated performance problem.

If a trigger occurs, evaluate managed PostgreSQL plus object storage first.
Store the encounter state as a versioned JSONB aggregate initially and promote
only proven query keys to relational columns or indexes. Decomposing every
domain entity into tables requires a separate architecture decision defining
transaction boundaries, migrations, sync semantics, cascades, and exact
round-trip compatibility with `EncounterState`.

## Non-goals

This decision does not add:

- GraphQL or another query layer.
- RxDB or third-party replication machinery.
- CRDTs or live multi-user editing.
- A user-configurable storage-provider contract.
- Server-side analytics or reporting infrastructure.
- Relational tables that duplicate facts already owned by `EncounterState`.
- Firebase Realtime Database or Firebase products without a concrete product or
  operational requirement.
- Firebase Hosting as a prerequisite for the backend architecture.

## Verification

The database decision is satisfied when:

- Repository and envelope tests prove lossless round trips, validation and
  migration, unsupported-version rejection, revision conflicts, failed-write
  preservation, and atomic import behavior.
- Persistence-provider tests prove autosave, explicit save, undo/redo saves,
  flush-before-navigation, recovery, and fresh history on load.
- Writer-lock and reset tests prove central mutation blocking, lock transfer,
  interrupted recovery, and application-owned cleanup only.
- The future cloud phase adds Firebase Emulator coverage for authentication,
  App Check integration, Security Rules, callable Functions, revision
  conflicts, offline retry, conflict copies, and asset ownership before cloud
  sync is considered complete.
