/** Shared examples for the guide and executable compatibility tests. */
export const NOTATION_GUIDE = [
  ["Dice pools and custom sides", "2d6 + d20 + 2d7", "Roll each pool and add its total."],
  ["Arithmetic", "(2d6+3)*2", "Use +, -, *, /, %, ** and parentheses; division may produce fractions."],
  ["Keep highest / lowest", "4d6kh3", "kh keeps highest; kl keeps lowest. Dropped values remain visible."],
  ["Drop highest / lowest", "4d6dl1", "dh drops highest; dl drops lowest."],
  ["Explode", "3d6!", "Roll again on a maximum face, adding extra dice."],
  ["Conditional explosion", "3d6!>4", "Explode at or above 4. < means at or below; = means equal."],
  ["Compound explosion", "3d6!!", "Add explosions into each original die's value; retain its individual faces."],
  ["Penetrating explosion", "3d6!p", "Subtract one from each extra roll's contribution."],
  ["Repeated reroll", "4d6r1", "Replace matching dice, retaining the last face. Earlier faces remain visible."],
  ["Reroll once", "4d6ro1", "Replace matching dice at most once."],
  ["Percentile", "d%", "Equivalent to d100."],
  ["Fate", "4dF", "Each die has a value of −1, 0, or +1."],
  ["Successes / failures", "6d6>4", "Count results at or above 4; f1 counts failures on 1. These are counts, not damage sums."],
  ["Critical markers", "1d20cs>18cf1", "Mark critical successes at or above 18 and critical failures on 1."],
  ["Grouped rolls", "{1d20+5,1d20+2}kh1", "Apply keep/drop or success/failure rules to whole groups."],
  ["Matches", "6d6mt", "m marks matching faces; mt counts matching sets. mt3 requires three matching dice."],
  ["Sorting", "6d6sd", "sa sorts ascending; sd sorts descending."],
  ["Math functions", "floor(1d20/2)", "floor, ceil, round, and abs are supported."],
  ["Labels", "2d6[Physical] + 1d6[Magic]", "Attach a label to a pool, modifier, or expression."],
  ["Calculated counts / sides", "(1d4)d6", "Counts and sides may be expressions; the execution budget still applies."]
] as const;
