// @vitest-environment node

import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "demo-combat-zone";
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") }
  });
});

beforeEach(async () => environment.clearFirestore());
afterAll(async () => environment.cleanup());

describe("Firestore API rules", () => {
  it("allows owner reads and denies cross-user reads", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/alice"), { revision: 1 });
    });

    await assertSucceeds(getDoc(doc(environment.authenticatedContext("alice").firestore(), "users/alice")));
    await assertFails(getDoc(doc(environment.authenticatedContext("bob").firestore(), "users/alice")));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "users/alice")));
  });

  it("denies direct client writes and internal reference-set reads", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "users/alice"), { revision: 1 }));
    await assertFails(getDoc(doc(alice, "users/alice/asset_reference_sets/library")));
  });
});
