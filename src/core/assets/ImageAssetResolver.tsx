import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { directImageSourceUrl, type ImageAssetSource } from "./imageAssetSource";

export type ImageAssetResolver = (source: ImageAssetSource) => Promise<Blob | string>;

const ResolverContext = createContext<ImageAssetResolver | null>(null);

type ResolvedEntry = {
  promise: Promise<string>;
  refs: number;
  revoke: boolean;
  url: string | null;
};

const resolvedByProvider = new WeakMap<
  ImageAssetResolver,
  Map<string, ResolvedEntry>
>();

function sourceKey(source: ImageAssetSource): string {
  switch (source.kind) {
    case "local_asset": return `local:${source.assetId}`;
    case "cloud_storage": return `cloud:${source.assetId}:${source.generation}`;
    case "google_drive": return `drive:${source.fileId}`;
    case "embedded": return `embedded:${source.dataUrl}`;
    case "url": return `url:${source.url}`;
  }
}

function acquireResolvedSource(
  resolver: ImageAssetResolver,
  source: ImageAssetSource
) {
  let entries = resolvedByProvider.get(resolver);
  if (!entries) {
    entries = new Map();
    resolvedByProvider.set(resolver, entries);
  }
  const key = sourceKey(source);
  let entry = entries.get(key);
  if (!entry) {
    entry = { promise: Promise.resolve(""), refs: 0, revoke: false, url: null };
    const created = entry;
    entry.promise = resolver(source)
      .then((value) => {
        created.revoke = typeof value !== "string";
        created.url = typeof value === "string" ? value : URL.createObjectURL(value);
        if (created.refs === 0) {
          if (created.revoke) URL.revokeObjectURL(created.url);
          entries?.delete(key);
        }
        return created.url;
      })
      .catch((error: unknown) => {
        entries?.delete(key);
        throw error;
      });
    entries.set(key, entry);
  }
  entry.refs += 1;
  const acquired = entry;
  return {
    promise: acquired.promise,
    release: () => {
      acquired.refs = Math.max(0, acquired.refs - 1);
      if (acquired.refs === 0 && acquired.url) {
        if (acquired.revoke) URL.revokeObjectURL(acquired.url);
        entries?.delete(key);
      }
    }
  };
}

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
  const resolutionKey = source ? sourceKey(source) : null;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [resolved, setResolved] = useState<string | null>(direct);

  useEffect(() => {
    let cancelled = false;
    setResolved(direct);
    const currentSource = sourceRef.current;
    if (!currentSource || direct || !resolver) return;
    const acquired = acquireResolvedSource(resolver, currentSource);
    void acquired.promise.then((value) => {
      if (cancelled) return;
      setResolved(value);
    }).catch(() => {
      if (!cancelled) setResolved(null);
    });
    return () => {
      cancelled = true;
      acquired.release();
    };
  }, [direct, resolutionKey, resolver]);

  return resolved;
}
