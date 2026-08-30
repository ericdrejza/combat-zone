import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SelectionState } from "@interaction/selection/types";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { CompactSelectionDeleteButton } from "@ui/canvas/CompactSelectionDeleteButton";

function selection(entityType: "actor" | "edge" | "zone"): SelectionState {
  return {
    overlayTargets: [],
    selectedEntityType: entityType,
    selectedIds: [`${entityType}-1`]
  };
}

describe("CompactSelectionDeleteButton", () => {
  it.each([
    ["actor", "actor"],
    ["edge", "edge"],
    ["zone", "zone"]
  ] as const)("offers deletion for a selected %s on its matching tool", async (
    entityType,
    activeToolId
  ) => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <CompactSelectionDeleteButton
        activeToolId={activeToolId}
        onDelete={onDelete}
        selection={selection(entityType)}
      />
    );

    await user.click(screen.getByRole("button", {
      name: `Delete selected ${entityType}`
    }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("stays hidden when the active tool does not match the selection", () => {
    render(
      <CompactSelectionDeleteButton
        activeToolId={"select" as ToolId}
        onDelete={() => undefined}
        selection={selection("zone")}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
