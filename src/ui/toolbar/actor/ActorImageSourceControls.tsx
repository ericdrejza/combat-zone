import { BookOpen, Link2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import type { ActorImageInput } from "@entities/actor/actorMutations";
import { createWebImageAsset } from "@library/webImageAsset";
import { WebImageUrlDialog } from "@ui/library/WebImageUrlDialog";

type ActorImageSourceControlsProps = {
  onImageChange: (image: ActorImageInput) => void;
  onOpenLibrary: () => void;
};

export function ActorImageSourceControls({
  onImageChange,
  onOpenLibrary
}: ActorImageSourceControlsProps) {
  const [webImageDialogOpen, setWebImageDialogOpen] = useState(false);

  function handleWebImageSubmit(url: string, linkedName: string) {
    const asset = createWebImageAsset(url);
    onImageChange({
      mediaType: asset.mediaType,
      name: linkedName.trim() || asset.name,
      source: asset.source
    });
    setWebImageDialogOpen(false);
  }

  return (
    <>
      <div className="flex gap-1">
        <button
          aria-label="Choose actor image from library"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas"
          onClick={onOpenLibrary}
          title="Choose actor image from library"
          type="button"
        >
          <BookOpen aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          aria-label="Link actor image"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas"
          onClick={() => setWebImageDialogOpen(true)}
          title="Link actor image"
          type="button"
        >
          <Link2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {webImageDialogOpen
        ? createPortal(
            <WebImageUrlDialog
              description="This image will be used for this actor without adding it to the Library."
              onClose={() => setWebImageDialogOpen(false)}
              onSubmit={handleWebImageSubmit}
              showName={false}
              title="Link actor image"
            />,
            document.body
          )
        : null}
    </>
  );
}
