import { money } from '$lib/format';
import type { HousingChoice } from '$lib/planning';
import type { ComparisonView, DecisionCriterion } from './decision';

const METRIC: Record<DecisionCriterion, 'after' | 'selectedRent' | 'takehome'> = {
  afterRent: 'after',
  rent: 'selectedRent',
  takeHome: 'takehome'
};

/** Labels for the "Rank by" choice, in the housing the plan is using. */
export function criterionLabel(criterion: DecisionCriterion, housing: HousingChoice): string {
  if (criterion === 'rent')
    return housing === '1br'
      ? 'Lowest 1-bed rent'
      : housing === '2br'
        ? 'Lowest 2-bed rent'
        : 'Lowest shared rent';
  if (criterion === 'takeHome') return 'Highest take-home';
  return 'Most left after rent';
}

/** Short city name: "Salt Lake City" from "Salt Lake City, UT". */
export function shortName(name: string): string {
  return name.replace(/,\s*[A-Z]{2}$/, '');
}

/**
 * One plain sentence naming the leader for a criterion and how far ahead it
 * is of the next city, e.g. "Raleigh leaves the most: $2,788 a month, $27
 * more than Salt Lake City."
 */
export function briefSentence(view: ComparisonView, criterion: DecisionCriterion): string {
  const brief = view.briefs[criterion];
  const key = METRIC[criterion];
  if (brief.status === 'not-enough-data' || !brief.leaders.length) {
    return criterion === 'rent'
      ? 'Add cities with rent estimates to see which costs least.'
      : 'Add cities with rent estimates to see which leaves the most.';
  }
  const value = brief.leaders[0].metrics[key].number ?? 0;
  const names = brief.leaders.map((entry) => shortName(entry.city.name));
  const leaderNames = new Set(brief.leaders.map((entry) => entry.city.name));
  const others = view.entries
    .filter((entry) => !leaderNames.has(entry.city.name) && entry.metrics[key].number != null)
    .sort((a, b) =>
      criterion === 'rent'
        ? (a.metrics[key].number ?? 0) - (b.metrics[key].number ?? 0)
        : (b.metrics[key].number ?? 0) - (a.metrics[key].number ?? 0)
    );
  const runnerUp = others[0];
  const gap = runnerUp ? Math.abs(value - (runnerUp.metrics[key].number ?? 0)) : null;
  const versus =
    runnerUp && gap != null
      ? `, ${money(gap)} ${criterion === 'rent' ? 'less' : 'more'} than ${shortName(runnerUp.city.name)}`
      : '';

  if (brief.status === 'tie') {
    const joined = names.join(' and ');
    if (criterion === 'rent')
      return `${joined} tie for the lowest rent at ${money(value)} a month.`;
    if (criterion === 'takeHome') return `${joined} tie for take-home at ${money(value)} a month.`;
    return `${joined} tie, each leaving ${money(value)} a month.`;
  }
  if (criterion === 'rent')
    return `${names[0]} has the lowest rent: ${money(value)} a month${versus}.`;
  if (criterion === 'takeHome')
    return `${names[0]} pays the most: ${money(value)} a month take-home${versus}.`;
  return `${names[0]} leaves the most: ${money(value)} a month${versus}.`;
}
