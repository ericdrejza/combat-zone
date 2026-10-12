import { Fragment } from "react";

import { LIBRARY_SECTION_IDS, LIBRARY_SECTION_LABELS, type LibrarySectionId } from "@library/types";

export type AssetLibraryTabId = LibrarySectionId | "characters";

const labels = { ...LIBRARY_SECTION_LABELS, characters: "Characters" };
const browseTabs: AssetLibraryTabId[] = [
  "encounters",
  ...([...LIBRARY_SECTION_IDS.filter((id) => id !== "encounters"), "characters"] as AssetLibraryTabId[])
    .sort((left, right) => labels[left].localeCompare(labels[right]))
];

/** Keeps encounter navigation distinct from the alphabetized asset categories. */
export function AssetLibraryTabs({ activeTabId, lockedSectionId, encounterOnly, onSelect }: {
  activeTabId: AssetLibraryTabId;
  lockedSectionId?: LibrarySectionId;
  encounterOnly: boolean;
  onSelect: (tabId: AssetLibraryTabId) => void;
}) {
  const tabs = lockedSectionId ? [lockedSectionId] : encounterOnly ? ["encounters" as const] : browseTabs;
  return <div aria-label="Asset Library sections" className="scrollbar-hidden flex shrink-0 overflow-x-auto border-b border-canvas-line px-3 pt-3 lg:px-5" role="tablist">
    {tabs.map((tabId, index) => <Fragment key={tabId}>
      {index === 1 && tabs[0] === "encounters" ? <div aria-hidden="true" className="mx-2 mb-2 mt-1 w-px shrink-0 self-stretch bg-canvas-line" /> : null}
      <button
        aria-selected={activeTabId === tabId}
        className={`shrink-0 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-canvas-ink ${activeTabId === tabId
          ? "border-canvas-line bg-canvas-surface text-canvas-ink hover:bg-canvas"
          : "border-transparent text-canvas-muted hover:bg-canvas"}`}
        onClick={() => onSelect(tabId)}
        role="tab"
        type="button"
      >{labels[tabId]}</button>
    </Fragment>)}
  </div>;
}
