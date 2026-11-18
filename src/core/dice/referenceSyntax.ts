/** Separators inside quoted names are literal characters, including escaped quotes. */
export function splitReference(text: string, delimiter: string): string[] {
  let quote: string | undefined, escaped = false, start = 0, depth = 0;
  const result: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (text[i] === "\\" && quote) { escaped = true; continue; }
    if (quote) { if (text[i] === quote) quote = undefined; }
    else if (text[i] === '"' || text[i] === "'" && (i === 0 || /[\s@/.,\[\]]/.test(text[i - 1]))) quote = text[i];
    if (!quote && text.slice(i, i + delimiter.length) === delimiter && (depth === 0 || delimiter === "[" || delimiter === "]")) {
      result.push(text.slice(start, i)); start = i + delimiter.length; i += delimiter.length - 1;
      continue;
    }
    if (!quote && text[i] === "[") depth++;
    if (!quote && text[i] === "]") depth = Math.max(0, depth - 1);
  }
  result.push(text.slice(start)); return result;
}
export function referenceQuote(value: string): '"' | "'" | undefined {
  const first = value.trimStart().replace(/^@/, "")[0];
  return first === '"' || first === "'" ? first : undefined;
}
export function referenceName(value: string): string {
  const text = value.trim().replace(/^@/, "");
  if (text.startsWith("'")) {
    if (/^'(?:[^'\\]|\\.)*'$/s.test(text)) {
      const parsed = text.slice(1, -1).replace(/\\(.)/gs, "$1");
      if (parsed.trim()) return parsed;
    }
    throw new Error("Close quoted reference names with single quotes.");
  }
  if (text.startsWith('"')) {
    try { const parsed: unknown = JSON.parse(text); if (typeof parsed === "string" && parsed.trim()) return parsed; } catch { /* Report below. */ }
    throw new Error("Close quoted reference names with double quotes.");
  }
  if (!text) throw new Error("Choose a reference name.");
  return text;
}
/** Keep explicitly typed quotes; quote names automatically only when they contain spaces. */
export function formatReferenceName(name: string, quoted: boolean | '"' | "'" = false) {
  if (quoted === "'") return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return quoted || /\s/.test(name) ? JSON.stringify(name) : name;
}
export const REFERENCE_COMPONENT = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?!['"])[^\s@/.,\[\]"<>!?;:]+)`;
const component = REFERENCE_COMPONENT;
const selector = `(?:${component}|\\[\\s*${component}(?:\\s*,\\s*${component})*\\s*\\])`;
export const referencePattern = new RegExp(`@${selector}(?:\\.${selector})*`, "g");
export function isRollInvocation(message: string) {
  const match = new RegExp(`^@${selector}(?:\\.${selector})*/`).exec(message.trim());
  return !!match;
}
