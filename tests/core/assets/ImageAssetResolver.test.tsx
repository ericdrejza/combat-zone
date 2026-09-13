import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ImageAssetResolverProvider,
  useResolvedImageSource
} from "@core/assets/ImageAssetResolver";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";

afterEach(() => vi.restoreAllMocks());

describe("ImageAssetResolver", () => {
  it("shares one object URL for the same repository asset and revokes it after the last consumer", async () => {
    const source: ImageAssetSource = {
      kind: "local_asset",
      assetId: "a".repeat(64),
      byteLength: 5
    };
    const resolver = vi.fn(async () => new Blob(["asset"]));
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = ({ children }: PropsWithChildren) => (
      <ImageAssetResolverProvider resolve={resolver}>{children}</ImageAssetResolverProvider>
    );
    const first = renderHook(() => useResolvedImageSource(source), { wrapper });
    const second = renderHook(() => useResolvedImageSource(source), { wrapper });

    await waitFor(() => expect(first.result.current).toBe("blob:shared"));
    await waitFor(() => expect(second.result.current).toBe("blob:shared"));
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    second.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:shared");
  });
});
