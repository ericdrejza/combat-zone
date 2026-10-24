import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlayerFullscreenButton } from '@ui/player_view/PlayerFullscreenButton';
import { usePlayerFullscreen } from '@ui/player_view/usePlayerFullscreen';

function Control({ ownerDocument, inline }: { ownerDocument: Document; inline: boolean }) {
  const control = usePlayerFullscreen(ownerDocument);
  return <PlayerFullscreenButton control={control} inline={inline} />;
}

function setup(supported = true, inline = false, permission: PermissionState | 'unsupported' | 'rejected' = 'denied') {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const output = frame.contentDocument!;
  let element: Element | null = null;
  const change = (next: Element | null) => {
    element = next;
    output.dispatchEvent(new Event('fullscreenchange'));
  };
  Object.defineProperties(output, {
    fullscreenEnabled: { configurable: true, value: supported },
    fullscreenElement: { configurable: true, get: () => element }
  });
  const enter = vi.fn(async () => { change(output.documentElement); });
  const exit = vi.fn(async () => { change(null); });
  Object.defineProperty(output.documentElement, 'requestFullscreen', { configurable: true, value: enter });
  Object.defineProperty(output, 'exitFullscreen', { configurable: true, value: exit });
  const status = Object.assign(new EventTarget(), { state: permission });
  const query = vi.fn(async () => {
    if (permission === 'rejected') throw new Error('Unsupported permission');
    return status;
  });
  Object.defineProperty(output.defaultView!.navigator, 'permissions', { configurable: true, value: permission === 'unsupported' ? undefined : { query } });
  const changePermission = (state: PermissionState) => { status.state = state; status.dispatchEvent(new Event('change')); };
  const focus = vi.spyOn(output.defaultView!, 'focus').mockImplementation(() => {});
  const view = render(<Control ownerDocument={output} inline={inline} />);
  return { output, enter, exit, change, query, changePermission, focus, view };
}

afterEach(() => document.querySelectorAll('iframe').forEach(frame => frame.remove()));

it('enters and exits the player document, and tracks browser-initiated exit', async () => {
  const { output, enter, exit, change } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Enter player window fullscreen' }));
  expect(enter).toHaveBeenCalledOnce();
  expect(enter.mock.contexts[0]).toBe(output.documentElement);
  const leave = screen.getByRole('button', { name: 'Exit player window fullscreen' });
  expect(leave).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(leave);
  expect(exit).toHaveBeenCalledOnce();
  expect(exit.mock.contexts[0]).toBe(output);
  act(() => change(output.documentElement));
  act(() => change(null));
  expect(screen.getByRole('button', { name: 'Enter player window fullscreen' })).toHaveAttribute('aria-pressed', 'false');
});

it.each(['denied', 'prompt', 'unsupported', 'rejected'] as const)('hands off to the player keyboard when automatic permission is unavailable: %s', async permission => {
  const { output, enter, change, exit, focus } = setup(true, true, permission);
  await act(async () => {});
  const button = screen.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(focus).toHaveBeenCalledOnce();
  expect(enter).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.keyDown(output.defaultView!, { key: 'Enter', repeat: true });
  expect(enter).not.toHaveBeenCalled();
  fireEvent.keyDown(output.defaultView!, { key: 'Enter' });
  expect(enter).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  // Exiting fullscreen requires no automatic-fullscreen grant.
  act(() => change(output.documentElement));
  fireEvent.click(screen.getByRole('button', { name: 'Exit player window fullscreen' }));
  expect(exit).toHaveBeenCalledOnce();
});

it('enables GM entry when permission is granted and reacts to browser setting changes', async () => {
  const { query, enter, changePermission } = setup(true, true, 'granted');
  const button = await screen.findByRole('button', { name: 'Enter player window fullscreen' });
  expect(button).toBeEnabled();
  expect(query).toHaveBeenCalledWith({ name: 'fullscreen', allowWithoutGesture: true });
  act(() => changePermission('denied'));
  expect(button).toBeEnabled();
  expect(button).toHaveAccessibleName('Focus player window, then press Enter or Spacebar for fullscreen');
  act(() => changePermission('granted'));
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(enter).toHaveBeenCalledOnce();
});

it.each(['Escape', 'blur', 'beforeunload'] as const)('cancels the keyboard handoff on %s', async reason => {
  const { output, enter } = setup(true, true);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' }));
  if (reason === 'Escape') fireEvent.keyDown(output.defaultView!, { key: 'Escape' });
  else fireEvent(output.defaultView!, new Event(reason));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.keyDown(output.defaultView!, { key: 'Enter' });
  expect(enter).not.toHaveBeenCalled();
});

it.each(['Enter', ' '])('accepts confirmation with %j and consumes the key before button activation or scrolling', async key => {
  const { output, enter } = setup(true, true);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' }));
  fireEvent.keyDown(output.defaultView!, { key, repeat: true });
  fireEvent.keyDown(output.defaultView!, { key, ctrlKey: true });
  expect(enter).not.toHaveBeenCalled();
  expect(fireEvent.keyDown(output.defaultView!, { key })).toBe(false);
  expect(enter).toHaveBeenCalledOnce();
});

it('does not require a new gesture when the player window already has valid activation', async () => {
  const { output, enter, focus } = setup(true, true);
  Object.defineProperty(output.defaultView!.navigator, 'userActivation', { configurable: true, value: { isActive: true } });
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' }));
  expect(enter).toHaveBeenCalledOnce();
  expect(focus).not.toHaveBeenCalled();
});

it('does not consume Enter before arming or inside text fields, and cleans up after unmount', async () => {
  const { output, enter, view } = setup(true, true);
  await act(async () => {});
  fireEvent.keyDown(output.defaultView!, { key: 'Enter' });
  expect(enter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' }));
  const input = output.createElement('input'); output.body.append(input);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(enter).not.toHaveBeenCalled();
  view.unmount();
  fireEvent.keyDown(output.defaultView!, { key: 'Enter' });
  expect(enter).not.toHaveBeenCalled();
});

it('disables fullscreen when the player document does not support it', () => {
  const { enter } = setup(false);
  const button = screen.getByRole('button', { name: 'Fullscreen unavailable in this browser' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(enter).not.toHaveBeenCalled();
});

it('handles browser rejection without claiming fullscreen and allows retry', async () => {
  const { enter } = setup();
  enter.mockRejectedValueOnce(new Error('Blocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Enter player window fullscreen' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enter player window fullscreen' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Enter player window fullscreen' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Exit player window fullscreen' })).toBeInTheDocument();
});
