import { act, fireEvent, render, screen } from '@testing-library/react';
import { createActor } from '@entities/actor/actorMutations';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ActorStatusHealthRow } from '@ui/panels/status_panel/ActorStatusHealthRow';
import { StatusDashboardContext } from '@ui/panels/status_panel/StatusDashboardContext';
import { healthRowImageSize } from '@ui/panels/status_panel/healthRowImageSize';

let width: number;
let contentWidth: number;
let contentHeight: number;
let resize: () => void;
const disconnect = vi.fn();

it.each([
  [519, 400, 140, 0],
  [520, 400, 140, 96],
  [600, 400, 140, 140],
  [800, 400, 140, 140],
  [600, 450, 140, 126],
  [600, 400, 200, 176],
  [600.75, 400, 200, 176],
])('fits a %s-wide row beside a %s-by-%s group using a %s image', (rowWidth, groupWidth, groupHeight, expected) => {
  expect(healthRowImageSize(rowWidth, groupWidth, groupHeight, 24)).toBe(expected);
});

beforeEach(() => {
  width = 600;
  contentWidth = 400;
  contentHeight = 140;
  disconnect.mockClear();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: 0, left: 0, right: 0, bottom: 0, height: contentHeight, width: contentWidth, top: 0,
      toJSON() {} };
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() { disconnect(); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(dashboard = true, withImage = true) {
  const actor = createActor(createEncounterState({ id: 'row', name: 'Row' }), {
    id: 'a', name: 'Alpha', currentZoneId: 'zoneless'
  }).actors.byId.a;
  if (withImage) actor.image = { kind: 'url', url: 'https://example.com/alpha.png' };
  return render(<StatusDashboardContext.Provider value={dashboard}><ActorStatusHealthRow actor={actor} names={<p>Alpha</p>}>
    <fieldset aria-label="Health"><legend>Health</legend></fieldset>
    <section aria-label="Hit points">10 / 20</section>
  </ActorStatusHealthRow></StatusDashboardContext.Provider>);
}

it('keeps the name and health together beside the image and responds to available width', () => {
  setup();
  const group = screen.getByRole('img', { name: 'Alpha token' }).parentElement!.previousElementSibling as HTMLElement;
  expect(group).toContainElement(screen.getByText('Alpha'));
  expect(group).toContainElement(screen.getByLabelText('Health'));
  expect(group).toContainElement(screen.getByLabelText('Hit points'));
  width = 519;
  act(() => resize());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Health')).toBeInTheDocument();
  expect(screen.getByLabelText('Hit points')).toBeInTheDocument();
  width = 520;
  act(() => resize());
  expect(screen.getByRole('img', { name: 'Alpha token' })).toBeInTheDocument();
  contentWidth = 450;
  act(() => resize());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  contentWidth = 400;
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole('img', { name: 'Alpha token' })).toBeInTheDocument();
  contentHeight = 80;
  act(() => resize());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it.each([[false, true], [true, false]])('adds no row image for dashboard=%s and withImage=%s', (dashboard, withImage) => {
  setup(dashboard, withImage);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('restores the image beside name and Health when hit points wraps, without moving the controls', () => {
  width = 400;
  contentWidth = 400;
  contentHeight = 206;
  let wrapped = false;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const label = this.getAttribute('aria-label');
    const health = label === 'Health';
    const hp = label === 'Hit points';
    const name = this.firstElementChild?.tagName === 'P';
    const top = health ? 40 : hp ? wrapped ? 124 : 40 : 0;
    const elementWidth = health ? 176 : hp ? 240 : name ? 120 : contentWidth;
    const height = health ? 68 : hp ? 82 : name ? 24 : contentHeight;
    return { x: 0, y: top, left: 0, right: elementWidth, width: elementWidth, top, bottom: top + height, height, toJSON() {} };
  });
  setup();
  const health = screen.getByLabelText('Health');
  const hitPoints = screen.getByLabelText('Hit points');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  wrapped = true;
  act(() => resize());
  expect(screen.getByRole('img', { name: 'Alpha token' })).toBeInTheDocument();
  expect(screen.getByLabelText('Health')).toBe(health);
  expect(screen.getByLabelText('Hit points')).toBe(hitPoints);
  width = 295;
  act(() => resize());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  width = 296;
  act(() => resize());
  expect(screen.getByRole('img', { name: 'Alpha token' })).toBeInTheDocument();
  wrapped = false;
  act(() => resize());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('disconnects measurement when the health row unmounts', () => {
  const view = setup();
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
