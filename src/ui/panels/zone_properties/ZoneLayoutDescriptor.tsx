import type { LayoutDescriptor } from "@core/layout/types";

type ZoneLayoutDescriptorProps = {
  descriptor: LayoutDescriptor;
};

export function ZoneLayoutDescriptor({
  descriptor
}: ZoneLayoutDescriptorProps) {
  return (
    <div className="rounded-2xl border border-canvas-line bg-canvas-surface p-3 text-xs text-canvas-muted">
      Current layout descriptor: {descriptor.strategy}, {descriptor.orientation},{" "}
      {descriptor.sections.length} section
      {descriptor.sections.length === 1 ? "" : "s"}.
    </div>
  );
}
