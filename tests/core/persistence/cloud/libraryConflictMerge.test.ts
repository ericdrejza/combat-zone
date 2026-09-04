import { createEmptyLibraryState } from "@core/persistence";
import { mergeLibraryStates } from "@core/persistence/cloud";

function withFolder(name: string) {
  const state = createEmptyLibraryState();
  const section = state.sections.tokens;
  section.nodesById.item = {
    id: "item", name, parentId: section.rootId, sectionId: "tokens", type: "folder", childIds: []
  };
  section.nodesById[section.rootId].childIds = ["item"];
  return state;
}

describe("Library three-way merge", () => {
  it("keeps the remote node and creates a named local conflict copy", () => {
    const result = mergeLibraryStates(withFolder("Base"), withFolder("Local"), withFolder("Remote"));
    expect(result.state.sections.tokens.nodesById.item.name).toBe("Remote");
    const conflictId = result.localConflictIds.get("item");
    expect(conflictId).toBeTruthy();
    expect(result.state.sections.tokens.nodesById[conflictId!].name).toBe("Local (Conflict copy)");
    expect(result.state.sections.tokens.nodesById[result.state.sections.tokens.rootId].childIds)
      .toContain(conflictId);
  });

  it("applies a one-sided local change without cloning", () => {
    const result = mergeLibraryStates(withFolder("Base"), withFolder("Local"), withFolder("Base"));
    expect(result.state.sections.tokens.nodesById.item.name).toBe("Local");
    expect(result.localConflictIds.size).toBe(0);
  });

  it("clones a conflicting folder subtree and rewrites its hierarchy", () => {
    const base = withFolder("Base");
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.sections.tokens.nodesById.item.name = "Local folder";
    remote.sections.tokens.nodesById.item.name = "Remote folder";
    local.sections.tokens.nodesById.child = {
      id: "child", name: "Child", parentId: "item", sectionId: "tokens", type: "folder", childIds: []
    };
    local.sections.tokens.nodesById.item.childIds = ["child"];

    const result = mergeLibraryStates(base, local, remote);
    const folderId = result.localConflictIds.get("item")!;
    const childId = result.localConflictIds.get("child")!;
    expect(result.state.sections.tokens.nodesById[childId].parentId).toBe(folderId);
    expect(result.state.sections.tokens.nodesById[folderId].childIds).toContain(childId);
  });
});
