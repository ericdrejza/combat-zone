export type AnnotationKind = "arrow" | "text" | "marker" | "measurement" | "gmNote";

export type Annotation = {
  id: string;
  kind: AnnotationKind;
  label?: string;
  metadata: Record<string, unknown>;
};
