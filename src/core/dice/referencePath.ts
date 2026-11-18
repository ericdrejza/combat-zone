import { referenceName, referenceQuote, splitReference } from "./referenceSyntax";

export type ReferenceItem = { raw: string; name: string; start: number; end: number; quoted: boolean };
export type ReferenceSegment = { start: number; end: number; list: boolean; items: ReferenceItem[] };
export type ReferenceToken = { text: string; start: number; end: number };

/** Keep token offsets so each named entity retains its own historical display span. */
export function parseReferencePath(text: string): ReferenceSegment[] {
  const offset = text.startsWith("@") ? 1 : 0;
  let position = offset;
  return splitReference(text.slice(offset), ".").map(raw => {
    const start = position + raw.length - raw.trimStart().length;
    position += raw.length + 1;
    const value = raw.trim();
    const list = value.startsWith("[");
    if (!value || list && !value.endsWith("]")) throw new Error("Complete each reference name and close its list with ].");
    const content = list ? value.slice(1, -1) : value;
    const values = list ? splitReference(content, ",") : [content];
    let itemPosition = start + (list ? 1 : 0);
    const items = values.map(part => {
      const itemStart = itemPosition + part.length - part.trimStart().length;
      itemPosition += part.length + 1;
      const raw = part.trim();
      const quoted = !!referenceQuote(raw);
      if (!quoted && /[\s\[\],]/.test(raw)) throw new Error("Quote multiword reference names and use flat comma-separated lists.");
      return { raw, name: referenceName(raw), start: itemStart, end: itemStart + raw.length, quoted };
    });
    return { start, end: start + value.length, list, items };
  });
}

/** Lists/quoted names may contain spaces and commas without ending their reference. */
export function referenceTokens(message: string, partial = false): ReferenceToken[] {
  const tokens: ReferenceToken[] = [];
  for (let start = 0; start < message.length; start++) {
    if (message[start] !== "@" || start > 0 && !/[\s\[,]/.test(message[start - 1])) continue;
    let quote: string | undefined, escaped = false, depth = 0, end = start + 1;
    for (; end < message.length; end++) {
      const char = message[end];
      if (escaped) { escaped = false; continue; }
      if (quote) {
        if (char === "\\") escaped = true;
        else if (char === quote) quote = undefined;
        continue;
      }
      if (char === '"' || char === "'" && /[@.\[,\s]/.test(message[end - 1])) { quote = char; continue; }
      if (char === "[") depth++;
      else if (char === "]") { if (!depth) break; depth--; }
      else if (!depth && /[\s,@/<>!?;:]/.test(char)) break;
    }
    if (!partial) while (message[end - 1] === ".") end--;
    tokens.push({ text: message.slice(start, end), start, end });
    start = Math.max(start, end - 1);
  }
  return tokens;
}

/** Stable keys distinguish duplicate names at each list position without storing derived relationships. */
export function referenceItemKey(key: string, segment: number, item: number) {
  return `${key}:path:${segment}:${item}`;
}

/** An outer target list owns commas; commas inside a scoped selector do not advance targets. */
export function referenceBindingKey(message: string, start: number): string {
  const sections = splitReference(message.slice(0, start), "->");
  if (sections.length > 1) {
    const targetPrefix = sections.at(-1)!.trimStart().replace(/^\[/, "");
    return `target:${splitReference(targetPrefix, ",").length - 1}`;
  }
  return start === 0 ? "source" : `mention:${start}`;
}
