import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { MotionValue } from 'motion/react';
import { usePlayerAudience } from './PlayerSceneSource';

const Context = createContext<Map<string, MotionValue> | null>(null);

export function LiveSceneMotionProvider({ children }: PropsWithChildren) {
  const [values] = useState(() => new Map<string, MotionValue>());
  return <Context.Provider value={values}>{children}</Context.Provider>;
}

/** The GM owns animation and gestures; projection only subscribes to those same MotionValues. */
export function useLiveSceneMotion<T extends string | number>(key: string, local: MotionValue<T>) {
  const values = useContext(Context);
  const player = usePlayerAudience();
  if (!player) values?.set(key, local);
  useEffect(() => {
    if (!player) values?.set(key, local);
    return () => { if (!player && values?.get(key) === local) values.delete(key); };
  }, [values, key, local, player]);
  return (player ? values?.get(key) as MotionValue<T> | undefined : undefined) ?? local;
}
