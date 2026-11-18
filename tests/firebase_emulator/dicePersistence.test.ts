import { snapshotReferences } from "@core/dice/referenceSnapshots";
// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { FirebaseApiService } from "../../functions/src/api/service";
import { CLOUD_RECORD_SCHEMA_VERSION, FIREBASE_API_VERSION } from "@combat-zone/firebase-api";
import { diceEncounter } from "../core/dice/fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { resolveInvocation } from "@core/dice/resolveInvocation";
const projectId = "demo-combat-zone";
let environment: RulesTestEnvironment;
beforeAll(async () => {
  if (!getApps().length) initializeApp({ projectId });
  environment = await initializeTestEnvironment({ projectId });
});
afterAll(async () => { await environment.cleanup(); await Promise.all(getApps().map(deleteApp)); });
it("persists roll faces, pending definitions and applications, rejecting invalid replacement atomically", async () => {
  const state = diceEncounter();
  const roll = evaluateDice("d6!~2", () => .99);
  state.chatMessages = { allIds: ["m"], byId: { m: { id: "m", timestamp: 42, message: "attack @Guard", references: snapshotReferences(state, "attack @Guard"), sender: { id: "gm", name: "GM", color: null }, rolls: [roll], invocation: resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard') } } };
  state.rollApplications = { allIds: ["r"], byId: { r: { id: "r", resultId: roll.id, actorId: "b", kind: "damage", amount: 4 } } };
  const command = { apiVersion: FIREBASE_API_VERSION, mutationId: "dice-first", expectedRevision: null,
    payload: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) } };
  const service = new FirebaseApiService();
  await service.commitEncounter("dice-emulator", command);
  const ref = getFirestore().doc(`users/dice-emulator/encounters/${state.id}`);
  expect((await ref.get()).data()?.state).toEqual(state);
  const invalid = structuredClone(command); invalid.mutationId = "dice-invalid";
  invalid.payload.state.chatMessages.byId.m.rolls[0].node.valid = "invalid";
  expect(() => service.commitEncounter("dice-emulator", invalid)).toThrow();
  expect((await ref.get()).data()?.state).toEqual(state);
  const invalidReference = structuredClone(command); invalidReference.mutationId = "reference-invalid";
  invalidReference.payload.state.chatMessages.byId.m.references[0].end = 1000;
  expect(() => service.commitEncounter("dice-emulator", invalidReference)).toThrow();
  expect((await ref.get()).data()?.state).toEqual(state);
});

it('persists independent check targets and rejects association corruption without replacing the save', async () => {
  const state = diceEncounter(); state.actors.byId.a.rollables!.byId.slash.checkRollMode = 'ask';
  const invocation = resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Guard, @Scout]'); invocation.checkRollMode = 'perTarget';
  const rolls = invocation.targets.map((target, index) => ({ ...evaluateDice(String(index + 10)), targetId: target.id, role: 'check' as const }));
  state.chatMessages = { allIds: ['m'], byId: { m: { id: 'm', message: 'Check roll', timestamp: 1, sender: { id: 'gm', name: 'GM', color: null }, rolls, invocation } } };
  const service = new FirebaseApiService();
  const command = { apiVersion: FIREBASE_API_VERSION, mutationId: 'checks-first', expectedRevision: null,
    payload: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) } };
  await service.commitEncounter('check-modes-emulator', command);
  const ref = getFirestore().doc(`users/check-modes-emulator/encounters/${state.id}`);
  expect((await ref.get()).data()?.state).toEqual(state);
  const invalid = structuredClone(command); invalid.mutationId = 'checks-invalid'; invalid.payload.state.chatMessages.byId.m.rolls[0].targetId = 'unknown';
  expect(() => service.commitEncounter('check-modes-emulator', invalid)).toThrow();
  expect((await ref.get()).data()?.state).toEqual(state);
});
