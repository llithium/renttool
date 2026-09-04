/** Canonical identity key used for membership and persisted city records. */
export function cityIdentity(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[.-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key === 'new york city ny' ? 'new york ny' : key;
}
