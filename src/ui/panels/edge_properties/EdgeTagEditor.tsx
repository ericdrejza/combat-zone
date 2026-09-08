import { X } from "lucide-react";
import type { KeyboardEvent } from "react";

type Props = {
  onChange: (tags: string[]) => void;
  tags: string[];
};

/** Keeps interaction tags discrete so notes remain the only free-form text field. */
export function EdgeTagEditor({ onChange, tags }: Props) {
  function addTag(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const input = event.currentTarget;
    const tag = input.value.trim();
    if (!tag) return;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    input.value = "";
  }

  return (
    <div className="space-y-2">
      <span className="font-semibold text-canvas-ink">Tags</span>
      <input
        aria-label="Add interaction tag"
        className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2"
        onKeyDown={addTag}
        placeholder="Type a tag and press Enter"
      />
      {tags.length > 0 ? (
        <div aria-label="Interaction tags" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              aria-label={`Remove tag ${tag}`}
              className="group inline-flex items-center gap-1 rounded-full bg-canvas-ink px-2.5 py-1 text-xs font-medium text-canvas-on-ink"
              onClick={() => onChange(tags.filter((candidate) => candidate !== tag))}
              type="button"
            >
              <span>{tag}</span>
              <X aria-hidden="true" className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
