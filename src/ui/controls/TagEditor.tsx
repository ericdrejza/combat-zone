import { X } from "lucide-react";
import type { KeyboardEvent } from "react";

type Props = {
  onChange: (tags: string[]) => void;
  tags: string[];
  disabled?: boolean;
  inputLabel?: string;
  tagsLabel?: string;
};

/** Keeps tags discrete so notes remain the only free-form text field. */
export function TagEditor({ onChange, tags, disabled = false, inputLabel = "Add interaction tag", tagsLabel = "Interaction tags" }: Props) {
  function addTag(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || event.key !== "Enter") return;
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
        aria-label={inputLabel}
        disabled={disabled}
        className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 enabled:hover:border-canvas-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40"
        onKeyDown={addTag}
        placeholder="Type a tag and press Enter"
      />
      {tags.length > 0 ? (
        <div aria-label={tagsLabel} className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <button
              key={`${tag}:${index}`}
              aria-label={`Remove tag ${tag}`}
              disabled={disabled}
              className="group inline-flex items-center gap-1 rounded-full bg-canvas-ink px-2.5 py-1 text-xs font-medium text-canvas-on-ink enabled:hover:bg-canvas-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-ink disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onChange(tags.filter((candidate) => candidate !== tag))}
              type="button"
            >
              <span>{tag}</span>
              <X aria-hidden="true" className={disabled ? "h-3 w-3 opacity-0" : "h-3 w-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
