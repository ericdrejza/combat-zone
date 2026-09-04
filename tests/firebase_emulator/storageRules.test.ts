// @vitest-environment node

import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-combat-zone";
const assetId = "a".repeat(64);
const path = `users/alice/assets/${assetId}`;
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") }
  });
});

beforeEach(async () => {
  await Promise.all([environment.clearFirestore(), environment.clearStorage()]);
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice/upload_reservations/reservation-1"), {
      assetId, expectedBytes: 5, mediaType: "image/png", status: "reserved"
    });
  });
});
afterAll(async () => environment.cleanup());

const metadata = {
  contentType: "image/png",
  customMetadata: { assetId, ownerId: "alice", reservationId: "reservation-1" }
};

describe("Cloud Storage rules", () => {
  it("permits only a reservation-backed owner create and denies overwrite/delete", async () => {
    const alice = ref(environment.authenticatedContext("alice").storage(), path);
    const bob = ref(environment.authenticatedContext("bob").storage(), path);
    await assertFails(uploadBytes(bob, new Uint8Array(5), metadata));
    await assertFails(uploadBytes(alice, new Uint8Array(4), metadata));
    await assertSucceeds(uploadBytes(alice, new Uint8Array(5), metadata));
    await assertFails(uploadBytes(alice, new Uint8Array(5), metadata));
    await assertFails(deleteObject(alice));
  });

  it("permits ready-object reads only to the owner", async () => {
    const readAssetId = "b".repeat(64);
    const readPath = `users/alice/assets/${readAssetId}`;
    const readMetadata = {
      contentType: "image/png",
      customMetadata: { assetId: readAssetId, ownerId: "alice", reservationId: "reservation-2" }
    };
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/alice/upload_reservations/reservation-2"), {
        assetId: readAssetId, expectedBytes: 5, mediaType: "image/png", status: "reserved"
      });
    });
    const alice = ref(environment.authenticatedContext("alice").storage(), readPath);
    await assertSucceeds(uploadBytes(alice, new Uint8Array(5), readMetadata));
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/alice/assets/${readAssetId}`), { status: "ready" });
    });
    await assertSucceeds(getBytes(alice));
    await assertFails(getBytes(ref(environment.authenticatedContext("bob").storage(), readPath)));
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), readPath)));
  });
});
