import { ScanSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { sameImageFocus } from "@core/assets/imageFocus";
import type { Actor } from "@entities/actor/types";
import type { UpdateActorPropertiesInput } from "@entities/actor/actorMutations";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { RootState } from "@store/store";
import { ImageFocusDialog } from "@ui/library/ImageFocusDialog";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ToolbarOptionButton } from "@ui/toolbar/ToolbarOption";

/** The actor owns a framing snapshot; resetting copies today's token default. */
export function ActorImageFocusControl({ actor, onChange }: { actor: Actor; onChange: (properties: UpdateActorPropertiesInput) => void }) {
  const tokens = useSelector((state: RootState) => state.library.sections.tokens);
  const { readOnly } = usePersistence();
  const [editing, setEditing] = useState<{ actorId: string; sourceKey: string } | null>(null);
  const sourceKey = JSON.stringify(actor.image);
  const valid = editing?.actorId === actor.id && editing.sourceKey === sourceKey;
  const token = typeof actor.metadata.sourceLibraryNodeId === "string" ? resolveLibraryAsset(tokens, actor.metadata.sourceLibraryNodeId) : null;
  useEffect(() => { if (editing && !valid) setEditing(null); }, [editing, valid]);

  return <>
    <ToolbarOptionButton aria-label="Adjust actor image focus" title="Adjust actor image focus" disabled={readOnly || !actor.image}
      onClick={() => setEditing({ actorId: actor.id, sourceKey })}>
      <ScanSquare aria-hidden="true" className="h-4 w-4" />
    </ToolbarOptionButton>
    {valid && actor.image ? <ImageFocusDialog title="Adjust actor image focus" source={actor.image}
      mediaType={typeof actor.metadata.sourceAssetMediaType === "string" ? actor.metadata.sourceAssetMediaType : undefined}
      initialFocus={actor.imageFocus} tokenFocus={token ? token.imageFocus ?? null : undefined} readOnly={readOnly}
      onClose={() => setEditing(null)} onSave={focus => {
        if (!readOnly && !sameImageFocus(actor.imageFocus, focus)) onChange({ imageFocus: focus ?? null });
        setEditing(null);
      }} /> : null}
  </>;
}
