import { render, screen } from '@testing-library/react';
import { ImageAssetResolverProvider } from '@core/assets/ImageAssetResolver';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { ActorStatusName } from '@ui/panels/status_panel/ActorStatusName';

function actor() {
  return createActor(createEncounterState({ id: 'name', name: 'Name' }), {
    id: 'a', name: 'Alpha', currentZoneId: 'zoneless'
  }).actors.byId.a;
}

it('shows the actor name without an image placeholder when no image exists', () => {
  render(<ActorStatusName actor={actor()} />);
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('follows actor image changes and removes the thumbnail when cleared', () => {
  const selected = actor();
  const view = render(<ActorStatusName actor={{ ...selected, image: { kind: 'url', url: 'https://example.com/alpha.png' } }} />);
  expect(screen.getByRole('img', { name: 'Alpha token' })).toHaveAttribute('src', 'https://example.com/alpha.png');
  view.rerender(<ActorStatusName actor={{ ...selected, image: { kind: 'embedded', dataUrl: 'data:image/png;base64,alpha' } }} />);
  expect(screen.getByRole('img', { name: 'Alpha token' })).toHaveAttribute('src', 'data:image/png;base64,alpha');
  view.rerender(<ActorStatusName actor={selected} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('Alpha')).toBeInTheDocument();
});

it('resolves stored token images through the shared asset resolver', async () => {
  const source = { kind: 'local_asset' as const, assetId: 'a'.repeat(64), byteLength: 5 };
  const resolve = vi.fn().mockResolvedValue('blob:alpha-token');
  render(<ImageAssetResolverProvider resolve={resolve}><ActorStatusName actor={{ ...actor(), image: source }} /></ImageAssetResolverProvider>);
  expect(await screen.findByRole('img', { name: 'Alpha token' })).toHaveAttribute('src', 'blob:alpha-token');
  expect(resolve).toHaveBeenCalledWith(source);
});
