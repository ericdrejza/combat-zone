import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLogReferenceGestures } from "@ui/dice/useLogReferenceGestures";
function Reference({ select, navigate, session }: { select: () => void; navigate: () => void; session?: number }) {
  return <button {...useLogReferenceGestures(select, navigate, session)}>Reference</button>;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it('waits briefly before pointer selection so layout changes cannot interrupt a second click', () => {
  const select = vi.fn(), navigate = vi.fn(); render(<Reference select={select} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button'), { detail: 1 });
  expect(select).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(250));
  expect(select).toHaveBeenCalledOnce(); expect(navigate).not.toHaveBeenCalled();
});
it('cancels pending pointer selection and navigates once on double-click', () => {
  const select = vi.fn(), navigate = vi.fn(); render(<Reference select={select} navigate={navigate} />);
  const button = screen.getByRole('button'); fireEvent.click(button, { detail: 1 });
  act(() => vi.advanceTimersByTime(100));
  fireEvent.click(button, { detail: 2 }); fireEvent.doubleClick(button, { detail: 2 });
  act(() => vi.advanceTimersByTime(500));
  expect(navigate).toHaveBeenCalledOnce(); expect(select).not.toHaveBeenCalled();
});
it('selects immediately for native keyboard or assistive activation', () => {
  const select = vi.fn(), navigate = vi.fn(); render(<Reference select={select} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button'), { detail: 0 });
  expect(select).toHaveBeenCalledOnce(); expect(navigate).not.toHaveBeenCalled();
});
it('does not select after the reference unmounts', () => {
  const select = vi.fn(), navigate = vi.fn(); const view = render(<Reference select={select} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button'), { detail: 1 }); view.unmount();
  act(() => vi.advanceTimersByTime(500)); expect(select).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
});
it('does not apply a queued click to a newly loaded encounter', () => {
  const select = vi.fn(), navigate = vi.fn(); const view = render(<Reference select={select} navigate={navigate} session={1} />);
  fireEvent.click(screen.getByRole('button'), { detail: 1 });
  view.rerender(<Reference select={select} navigate={navigate} session={2} />);
  act(() => vi.advanceTimersByTime(500)); expect(select).not.toHaveBeenCalled();
});
