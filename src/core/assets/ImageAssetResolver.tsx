import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { directImageSourceUrl, type ImageAssetSource } from "./imageAssetSource";

export type ImageAssetResolver = (source: ImageAssetSource) => Promise<Blob | string>;

const ResolverContext = createContext<ImageAssetResolver | null>(null);

export function ImageAssetResolverProvider({
  children,
  resolve
}: PropsWithChildren<{ resolve: ImageAssetResolver | null }>) {
  return <ResolverContext.Provider value={resolve}>{children}</ResolverContext.Provider>;
}

/** Resolves provider-backed sources to short-lived object URLs without persisting them in domain state. */
export function useResolvedImageSource(source: ImageAssetSource | null | undefined): string | null {
  const resolver = useContext(ResolverContext);
  const direct = source ? directImageSourceUrl(source) : null;
  const [resolved, setResolved] = useState<string | null>(direct);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setResolved(direct);
    if (!source || direct || !resolver) return;
    void resolver(source).then((value) => {
      if (cancelled) return;
      objectUrl = typeof value === "string" ? value : URL.createObjectURL(value);
      setResolved(objectUrl);
    }).catch(() => setResolved(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [direct, resolver, source]);

  return resolved;
}
