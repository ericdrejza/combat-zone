import { render, screen } from '@testing-library/react';
import { CanvasBackgroundLayer } from '@ui/canvas/background/CanvasBackgroundLayer';
import { drawCanvasBackgroundImage } from '@ui/canvas/canvasLuminance';
import type { EncounterBackgroundImage } from '@core/encounter/types';
vi.mock('@core/assets/ImageAssetResolver', () => ({ useResolvedImageSource: () => 'https://example.com/map.png' }));
vi.mock('@core/assets/useStillImageSource', () => ({ useStillImageSource: () => null }));
vi.mock('@ui/interface_preferences/InterfacePreferenceProvider', () => ({ useInterfacePreferences: () => ({ enableAssetAnimation: true }) }));
const background: EncounterBackgroundImage = { source: { kind: 'url', url: 'https://example.com/map.png' }, name: 'Map', mediaType: 'image/png', width: 290, height: 290, frame: { x: 5, y: 5, width: 290, height: 290 } };
describe('background placement in completed canvas', () => {
  it('renders media at its saved placement rather than stretching it into added margins', () => {
    const { rerender } = render(<svg><CanvasBackgroundLayer backgroundImage={background} canvasSize={{ width: 300, height: 300 }} /></svg>);
    const image = screen.getByLabelText('Canvas background image');
    expect(image).toHaveAttribute('x', '5'); expect(image).toHaveAttribute('y', '5');
    expect(image).toHaveAttribute('width', '290'); expect(image).toHaveAttribute('height', '290');
    rerender(<svg><CanvasBackgroundLayer backgroundImage={{ ...background, frame: undefined }} canvasSize={{ width: 300, height: 300 }} /></svg>);
    expect(image).toHaveAttribute('x', '0'); expect(image).toHaveAttribute('width', '300');
  });
  it.each([
    { x: 5, y: 5, width: 290, height: 290 },
    { x: 0, y: 0, width: 300, height: 300 }
  ])('samples image placement over an opaque canvas for frame %o', (frame) => {
    const context = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' }, image = {} as CanvasImageSource;
    drawCanvasBackgroundImage(context as unknown as CanvasRenderingContext2D, image, { width: 300, height: 300 }, frame, 'dark');
    expect(context.drawImage).toHaveBeenCalledWith(image, frame.x, frame.y, frame.width, frame.height);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 300, 300);
    expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(context.drawImage.mock.invocationCallOrder[0]);
  });
});
