/** `%term%` for (I)LIKE, with the user's `%`, `_` and `\` matched literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
