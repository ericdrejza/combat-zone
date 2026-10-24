import { createContext, useContext, type ReactNode } from 'react';
import { useTheme } from '@ui/theme/ThemeProvider';
import { CANVAS_BACKGROUND_COLORS } from '@ui/canvas/canvasConstants';
import type { BackgroundPixelReader } from './actorSurfaceContrast';

const Context = createContext<BackgroundPixelReader | null>(null);

/** Share the decoded map pixels between stationary tokens and drag portal visuals. */
export function ActorSurfaceProvider({ readBackground, children }: {
  readBackground?: BackgroundPixelReader;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return <Context.Provider value={readBackground ?? (() => CANVAS_BACKGROUND_COLORS[theme])}>
    {children}
  </Context.Provider>;
}

export const useActorBackgroundPixel = () => useContext(Context);
