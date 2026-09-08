import { Link2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

type WebImageUrlDialogProps = {
  description: string;
  onClose: () => void;
  onSubmit: (url: string, name: string) => void | Promise<void>;
  showName?: boolean;
  title: string;
};

export function WebImageUrlDialog({
  description,
  onClose,
  onSubmit,
  showName = true,
  title
}: WebImageUrlDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await onSubmit(url, showName ? name.trim() : "");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The image could not be loaded."
      );
      setPending(false);
    }
  }

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="viewport-overlay z-[70] flex items-center justify-center overflow-y-auto bg-black/30 p-6"
      role="dialog"
    >
      <form
        className="w-[min(28rem,92vw)] rounded-3xl border border-canvas-line bg-canvas-surface p-5 shadow-2xl"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="h-5 w-5" />
            <h3 className="font-display text-lg font-semibold">{title}</h3>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-canvas-muted">{description}</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="web-image-url">
          Image URL
        </label>
        <input
          autoFocus
          className="mt-1 w-full rounded-xl border border-canvas-line px-3 py-2 text-sm outline-none focus:border-canvas-ink"
          disabled={pending}
          id="web-image-url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/image.png"
          required
          type="url"
          value={url}
        />
        {showName ? (
          <>
            <label className="mt-4 block text-sm font-medium" htmlFor="web-image-name">
              Image name
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-canvas-line px-3 py-2 text-sm outline-none placeholder:text-canvas-muted focus:border-canvas-ink"
              disabled={pending}
              id="web-image-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Name (optional)"
              type="text"
              value={name}
            />
          </>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-xl border border-canvas-line px-4 py-2 text-sm font-medium transition hover:bg-canvas"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-canvas-on-ink disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Loading…" : "Add image"}
          </button>
        </div>
      </form>
    </div>
  );
}
