import type { ExportEnvelope } from "@core/persistence";

export function downloadExport(envelope: ExportEnvelope, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
