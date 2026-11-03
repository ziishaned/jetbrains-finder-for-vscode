// Expand replacement captures using JavaScript's replacement-string conventions.
function replacementFor(item, options, replacement) {
  if (!options.regex) return replacement;
  let expression;
  try { expression = new RegExp(options.query, `g${options.caseSensitive ? '' : 'i'}u`); }
  catch (error) { throw new Error(`This regular expression cannot be used for replacement: ${error.message}`); }
  let match;
  while ((match = expression.exec(item.text))) {
    if (match.index === item.start && match.index + match[0].length === item.end) {
      // Replace just this occurrence while retaining the original line as regex context.
      return item.text.replace(expressionForMatch(expression, item.start), replacement)
        .slice(item.start, undefined === item.end ? undefined : -(item.text.length - item.end) || undefined);
    }
    if (match.index > item.start) break;
    if (!match[0].length) expression.lastIndex++;
  }
  throw new Error('A search match could not be reproduced for replacement.');
}
function expressionForMatch(expression, start) {
  // A sticky expression preserves lookaround context and selects only this match.
  const sticky = new RegExp(expression.source, expression.flags.replace('g', '') + 'y');
  sticky.lastIndex = start;
  return sticky;
}
module.exports = { replacementFor };
