/** Whitespace folding is only for discovery; accepted completions retain the actual name. */
export function suggestionSearchText(text: string, compact = false): string {
  return (compact ? text.replace(/\s/g, "") : text).toLocaleLowerCase();
}

/** Map a folded prefix back to the original name so inline previews keep its spacing. */
export function suggestionSuffix(name: string, fragment: string, compact = false): string | null {
  const query = suggestionSearchText(fragment, compact);
  if (!suggestionSearchText(name, compact).startsWith(query)) return null;
  if (!query) return name;
  let end = 0;
  while (end < name.length && suggestionSearchText(name.slice(0, end), compact).length < query.length) end++;
  return name.slice(end);
}
