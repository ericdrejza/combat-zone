import { DICE_COMMAND_PATTERN } from "./commands";
import { parseDiceFormula } from "./parser";

/** Extract only explicit commands/brackets; plain prose containing dice notation is never rolled. */
export function messageFormulas(message: string): string[] {
  const command = message.match(DICE_COMMAND_PATTERN);
  if (command) {
    const args = command[2].trim();
    if (command[1].toLocaleLowerCase() === "rr") {
      const repeated = args.match(/^([\s\S]+)\s+(\S+)$/);
      const count = repeated && /^\d+$/.test(repeated[2]) ? Number(repeated[2]) : NaN;
      if (!repeated || !Number.isSafeInteger(count) || count < 1 || count > 20) throw new Error("Use /rr formula count, with a whole-number count from 1 to 20.");
      const formula = repeated[1].trim();
      parseDiceFormula(formula);
      return Array.from({ length: count }, () => formula);
    }
    parseDiceFormula(args); return [args];
  }
  const formulas: string[] = [];
  let index = 0;
  while (index < message.length) {
    const start = message.indexOf("[[", index);
    if (start < 0) break;
    let end = start + 2, label = false;
    for (; end < message.length; end++) {
      if (!label && message.slice(end, end + 2) === "]]") break;
      if (message[end] === "[") label = true;
      else if (message[end] === "]") label = false;
    }
    if (end === message.length) throw new Error("Close each inline roll with ]].");
    const formula = message.slice(start + 2, end).trim();
    parseDiceFormula(formula); formulas.push(formula); index = end + 2;
    if (formulas.length > 20) throw new Error("Send at most 20 rolls in one message.");
  }
  return formulas;
}
