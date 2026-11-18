const TEXT_LAYOUT = [
  "box-sizing", "width", "font-family", "font-size", "font-weight", "font-style",
  "font-variant", "font-stretch", "letter-spacing", "line-height", "text-indent",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-style", "word-break", "overflow-wrap", "tab-size"
];

/** Native selection offsets alone cannot distinguish visual lines in a wrapped textarea. */
export function isFirstDraftLine(input: HTMLTextAreaElement): boolean {
  const prefix = input.value.slice(0, input.selectionStart);
  if (prefix.includes("\n")) return false;
  if (!prefix || input.wrap === "off") return true;
  const ownerDocument = input.ownerDocument;
  const style = ownerDocument.defaultView?.getComputedStyle(input);
  if (!style) return true;
  const mirror = ownerDocument.createElement("div");
  for (const property of TEXT_LAYOUT) mirror.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(mirror.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", whiteSpace: "pre-wrap", overflowWrap: "break-word", left: "0", top: "0" });
  const text = ownerDocument.createTextNode(input.value + "\u200b");
  mirror.append(text);
  ownerDocument.body.append(mirror);
  try {
    const range = ownerDocument.createRange();
    if (typeof range.getBoundingClientRect !== "function") return true;
    range.setStart(text, 0); range.collapse(true);
    const firstTop = range.getBoundingClientRect().top;
    range.setStart(text, input.selectionStart); range.collapse(true);
    return range.getBoundingClientRect().top <= firstTop + 1;
  }
  finally { mirror.remove(); }
}
