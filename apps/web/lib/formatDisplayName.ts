/**
 * Normalizes a catalog name for display — item and monster names come from
 * the backend with inconsistent casing ("big pot", "SNAKE", "Basic Armor")
 * since the data was never guaranteed to be display-ready. Only words that
 * are entirely uppercase or entirely lowercase get re-cased to Title Case;
 * a word that's already mixed case (e.g. "2-Hand") is left untouched so
 * intentional stylizations don't get mangled.
 */
function normalizeWordCasing(word: string): string {
  const hasUpper = /[A-Z]/.test(word);
  const hasLower = /[a-z]/.test(word);
  if (hasUpper && hasLower) return word;
  if (!hasUpper && !hasLower) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Always pass item names and monster names through this before rendering —
 * never descriptions, which are reproduced as-is from the backend. */
export function formatDisplayName(name: string): string {
  return name.split(" ").map(normalizeWordCasing).join(" ");
}
