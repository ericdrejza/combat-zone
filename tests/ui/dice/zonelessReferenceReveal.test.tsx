import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setActiveTool } from "@interaction/interactionState";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { ZonelessActorPanel } from "@ui/panels/zoneless_actors/ZonelessActorPanel";
import { CompactZonelessActorPanel } from "@ui/panels/zoneless_actors/CompactZonelessActorPanel";
import { CompactPanelLauncher } from "@ui/panels/CompactPanelLauncher";
import { InterfacePreferenceProvider } from "@ui/interface_preferences/InterfacePreferenceProvider";

beforeEach(() => { store.dispatch(loadEncounterState(diceEncounter())); store.dispatch(setActiveTool('actor')); });

function setup(compact = false) {
  const state = store.getState().encounter.present;
  return render(<Provider store={store}><InterfacePreferenceProvider>
    <ChatMessageText message="@Guard" references={snapshotReferences(state, '@Guard')} />
    {compact ? <CompactPanelLauncher renderPanelContent={panel => panel.id === 'zoneless' ? <CompactZonelessActorPanel /> : null} />
      : <ZonelessActorPanel canvasBackgroundLuminance={0.5} isActorDragActive={false} onActorCreationDragOver={() => {}} onActorCreationDrop={() => {}} />}
  </InterfacePreferenceProvider></Provider>);
}

it('selects on click and expands/scrolls the selected actor on double-click', () => {
  setup();
  expect(screen.queryByRole('button', { name: 'Guard' })).not.toBeInTheDocument();
  const history = store.getState().encounter;
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['b']);
  expect(screen.queryByRole('button', { name: 'Guard' })).not.toBeInTheDocument();
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  const token = screen.getByRole('button', { name: 'Guard' });
  expect(token).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Collapse zoneless actors' })).toBeInTheDocument();
  // Repeating the same reference must reveal it again even if selection has not changed.
  const scroller = token.closest('aside')!.querySelector<HTMLElement>('.overflow-y-auto')!;
  scroller.style.overflowY = 'auto';
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
  const bounds = vi.spyOn(token, 'getBoundingClientRect').mockReturnValue({ top: 350, bottom: 400 } as DOMRect);
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(scroller.scrollTop).toBe(200);
  bounds.mockReturnValue({ top: 75, bottom: 125 } as DOMRect);
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(scroller.scrollTop).toBe(175);
  expect(store.getState().encounter).toBe(history);
});

it('opens the compact Zoneless drawer only on double-click with the actor selected', () => {
  setup(true);
  expect(screen.queryByRole('dialog', { name: 'Zoneless panel' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.queryByRole('dialog', { name: 'Zoneless panel' })).not.toBeInTheDocument();
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('dialog', { name: 'Zoneless panel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Guard' })).toHaveAttribute('aria-pressed', 'true');
});

it('switches to Select on click and reveals on double-click when starting from the Zone tool', () => {
  store.dispatch(setActiveTool('zone')); setup();
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(store.getState().interaction.activeToolId).toBe('select');
  expect(screen.getByRole('button', { name: 'Expand zoneless actors' })).toBeInTheDocument();
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('button', { name: 'Guard' })).toHaveAttribute('aria-pressed', 'true');
});
