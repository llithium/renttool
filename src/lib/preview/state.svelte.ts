import { page } from '$app/state';
import { goto } from '$app/navigation';
import type { HousingChoice } from '$lib/planning';
import { buildCityView, type CityView } from './model';

export const DEFAULT_CITY = 'Raleigh, NC';
export const DEFAULT_SALARY = 62000;

/** URL-backed preview state: ?city=&salary=&housing=&photo=off */
export function createPreviewState() {
  const params = $derived(page.url.searchParams);
  const city = $derived(params.get('city') ?? DEFAULT_CITY);
  const salary = $derived(Number(params.get('salary')) || DEFAULT_SALARY);
  const housing = $derived((params.get('housing') as HousingChoice) || '1br');
  const photo = $derived(params.get('photo') !== 'off');
  const view: CityView | null = $derived(buildCityView(city, salary, housing, { photo }));

  function set(
    next: Partial<{ city: string; salary: number; housing: HousingChoice; photo: boolean }>
  ) {
    const url = new URL(page.url);
    if (next.city != null) url.searchParams.set('city', next.city);
    if (next.salary != null) url.searchParams.set('salary', String(Math.round(next.salary)));
    if (next.housing != null) url.searchParams.set('housing', next.housing);
    if (next.photo != null) {
      if (next.photo) url.searchParams.delete('photo');
      else url.searchParams.set('photo', 'off');
    }
    void goto(url, { replaceState: true, keepFocus: true, noScroll: next.city == null });
  }

  return {
    get city() {
      return city;
    },
    get salary() {
      return salary;
    },
    get housing() {
      return housing;
    },
    get photo() {
      return photo;
    },
    get view() {
      return view;
    },
    set
  };
}

export type PreviewState = ReturnType<typeof createPreviewState>;
