/** Parse only recognizable legacy numeric population values. */
export function restorePopulation(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/,/g, '');
  const match = compact.match(/^(\d+(?:\.\d+)?)\s*([kKmM])?$/);
  if (!match) return null;
  const multiplier =
    match[2]?.toLowerCase() === 'm' ? 1_000_000 : match[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  const population = Number(match[1]) * multiplier;
  return Number.isFinite(population) && population > 0 ? population : null;
}
