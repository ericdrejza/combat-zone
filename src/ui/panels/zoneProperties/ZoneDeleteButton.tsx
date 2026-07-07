import { Trash2 } from "lucide-react";

type ZoneDeleteButtonProps = {
  onDeleteZone: () => void;
};

export function ZoneDeleteButton({ onDeleteZone }: ZoneDeleteButtonProps) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100"
      onClick={onDeleteZone}
      type="button"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
      Delete zone
    </button>
  );
}
