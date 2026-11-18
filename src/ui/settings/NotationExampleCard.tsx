import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";
import { TooltipIconButton } from "@ui/controls/TooltipIconButton";

/** Copy the executable formula without its heading or explanation. */
export function NotationExampleCard({ title, example, description }: { title: string; example: string; description: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    setError(""); setCopied(false);
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
    } catch {
      setError("Could not copy this example. Select and copy the formula.");
    }
  }
  const Icon = copied ? Check : Copy;
  return <article aria-labelledby={id} className="min-w-0 rounded-xl border border-canvas-line p-3">
    <div className="flex items-start justify-between gap-2">
      <h4 id={id} className="min-w-0 break-words font-semibold">{title}</h4>
      <TooltipIconButton label={`Copy ${title} example`} onClick={() => void copy()}><Icon aria-hidden="true" className="h-4 w-4" /></TooltipIconButton>
    </div>
    <code className="block break-words py-1 text-sm">{example}</code>
    <p className="text-sm text-canvas-muted">{description}</p>
    <p role="status" className="sr-only">{copied ? "Example copied." : ""}</p>
    {error ? <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
  </article>;
}
