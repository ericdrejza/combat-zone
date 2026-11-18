import { snapshotReferences, zoneReferenceColor } from "@core/dice/referenceSnapshots";
import { describe, expect, it } from "vitest";
import { createZone } from "@entities/zone/zoneMutations";
import { diceEncounter } from "./fixtures";
import { chatSuggestions } from "@core/dice/chatSuggestions";
import { resolveInvocation, invocationText } from "@core/dice/resolveInvocation";
import { resolveEntityReference } from "@core/dice/references";
import { formatReferenceName, isRollInvocation, referenceName, referencePattern, splitReference } from "@core/dice/referenceSyntax";

export function referenceEncounter() {
  let state = diceEncounter();
  state = createZone(state, { id: "z1", name: "Courtyard", polygon: [] });
  state = createZone(state, { id: "z2", name: "Great Hall", polygon: [] });
  state.actors.byId.b.currentZoneId = "z1"; state.actors.byId.b.layoutGroup = "enemy";
  state.actors.byId.c.currentZoneId = "z2"; state.actors.byId.c.layoutGroup = "ally";
  return state;
}
describe("chat references and completion", () => {
  it("distinguishes general prose mentions from explicit Rollable invocations", () => {
    expect(isRollInvocation('@Guard hello')).toBe(false);
    expect(isRollInvocation('hello @"Goblin Chief"')).toBe(false);
    expect(isRollInvocation('@"Goblin Chief"/Slash')).toBe(true);
    expect(isRollInvocation('@Courtyard.Guard/Slash')).toBe(true);
    expect([...('hi @Guard and @"Great Hall".Scout!').matchAll(referencePattern)].map(m => m[0])).toEqual(['@Guard', '@"Great Hall".Scout']);
  });
  it("ranks prefix matches ahead of interior matches, keeping all choices", () => {
    const state = referenceEncounter();
    state.actors.byId.a.name = "Healer"; state.actors.byId.b.name = "Actor"; state.actors.byId.c.name = "Ally";
    expect(chatSuggestions(state, '@a').map(c => c.name)).toEqual(['Actor', 'Ally', 'allies', 'Healer', 'Courtyard', 'Great Hall', 'neutrals']);
    expect(chatSuggestions(state, '/r').map(c => c.name)).toEqual(['/r', '/roll', '/rr']);
  });
  it("limits scoped choices to zone members and populated plural factions", () => {
    const state = referenceEncounter();
    expect(chatSuggestions(state, 'Hello @Courtyard.').map(c => c.name)).toEqual(['enemies', 'Guard']);
    expect(chatSuggestions(state, '@"Great Hall".').map(c => c.name)).toEqual(['allies', 'Scout']);
    expect(chatSuggestions(state, '@Courtyard.Sc')).toEqual([]);
    expect(resolveEntityReference(state, '@Courtyard.enemies', 'target:0').actorIds).toEqual(['b']);
    expect(() => resolveEntityReference(state, '@Courtyard.enemy', 'target:0')).toThrow(/No matching/);
  });
  it("expands zones and factions, deduplicates targets, and resolves duplicate names by zone", () => {
    const state = referenceEncounter(); state.actors.byId.c.name = 'Guard';
    expect(resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Courtyard, @Courtyard.enemies, @"Great Hall".Guard]').targets.map(t => t.id)).toEqual(['b', 'c']);
    expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard')).toThrow(/Choose/);
    state.zones.byId.z1.name = 'Guard';
    expect(() => resolveEntityReference(state, '@Guard', 'source')).toThrow(/Choose/);
    expect(resolveEntityReference(state, '@Guard', 'source', { source: 'z1' }).kind).toBe('zone');
  });
  it("only adds quotes for separators and preserves quotes entered manually", () => {
    const state = referenceEncounter();
    expect(chatSuggestions(state, '@Gu')[0].text).toBe('@Guard');
    expect(chatSuggestions(state, '@"Gu')[0].text).toBe('@"Guard"');
    expect(chatSuggestions(state, '@Gr')[0].text).toBe('@"Great Hall"');
    expect(invocationText('Guard', 'Slash')).toBe('@Guard/Slash');
    expect(invocationText('Goblin Chief', 'Heavy Strike')).toBe('@"Goblin Chief"/"Heavy Strike"');
  });
  it('preserves single quotes through completion, resolution, and sent reference snapshots', () => {
    const state = referenceEncounter();
    expect(chatSuggestions(state, "@'Goblin C")[0].text).toBe("@'Goblin Chief'");
    expect(chatSuggestions(state, "@'Great H")[0].text).toBe("@'Great Hall'");
    expect(chatSuggestions(state, "@'Goblin Chief'/'Sl")[0].text).toBe("'Slash'");
    expect(resolveInvocation(state, "@'Goblin Chief'/'Slash' -> @'Great Hall'.Scout").targets.map(t => t.id)).toEqual(['c']);
    expect(isRollInvocation("@'Goblin Chief'/'Slash'")).toBe(true);
    expect(snapshotReferences(state, "Hi @'Goblin Chief' and @'Great Hall'").map(r => r.entityId)).toEqual(['a', 'z2']);
  });
  it('keeps apostrophes inside unquoted names literal and handles escaped quotes within quoted names', () => {
    const name = "Chief's / hall, east";
    const quoted = formatReferenceName(name, "'");
    expect(referenceName(quoted)).toBe(name);
    expect(splitReference(`@${quoted}/Slash`, '/')).toEqual([`@${quoted}`, 'Slash']);
    expect(splitReference("@Chief's/Slash", '/')).toEqual(["@Chief's", 'Slash']);
    expect(() => referenceName("'Goblin Chief\"")).toThrow(/single quotes/);
  });
});

it("captures faction colors and opaque zone colors with border/default fallbacks", () => {
  const state = referenceEncounter(); const zone = state.zones.byId.z1;
  zone.colorFill = '#12345680'; zone.opacity = .2; zone.colorBorder = '#abcdef';
  expect(zoneReferenceColor(zone)).toBe('#123456');
  zone.opacity = 0; expect(zoneReferenceColor(zone)).toBe('#abcdef');
  zone.showBorder = false; expect(zoneReferenceColor(zone)).toBeNull();
  zone.opacity = .5; zone.colorFill = '#12345600'; expect(zoneReferenceColor(zone)).toBeNull();
  const spans = snapshotReferences(state, 'Hi @Courtyard.Guard and @"Great Hall"');
  expect(spans.map(r => r.kind)).toEqual(['zone', 'actor', 'zone']);
  expect(spans[1]).toMatchObject({ entityId: 'b', color: '#dc2626' });
  expect(spans[0].color).toBeNull();
});
it("blocks an empty zone/faction target instead of rolling an untargeted attack", () => {
  const state = referenceEncounter();
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Courtyard.allies')).toThrow(/No matching targets/);
  state.actors.byId.b.currentZoneId = 'zoneless';
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Courtyard')).toThrow(/No matching targets/);
});

it("completes the token at the caret without duplicating its suffix or overwriting following text", () => {
  const state = referenceEncounter();
  const draft = 'Hello @Guard, keep watch';
  const choice = chatSuggestions(state, draft, 9)[0];
  expect(draft.slice(0, choice.start) + choice.text + draft.slice(choice.end)).toBe(draft);
  const scoped = '@Courtyard.Guard';
  const member = chatSuggestions(state, scoped, 13)[0];
  expect(scoped.slice(0, member.start) + member.text + scoped.slice(member.end)).toBe(scoped);
});
