<script lang="ts">
  import type { City } from '$lib/types';
  import { sentenceLabel } from '$lib/format';
  import { housingRentLabel, type HousingChoice } from '$lib/planning';

  let {
    city,
    housing = '1br',
    class: className = ''
  }: { city: City; housing?: HousingChoice; class?: string } = $props();
  let rentLabel = $derived(sentenceLabel(housingRentLabel(city, housing)));
</script>

<aside class="text-sm/relaxed text-muted {className}">
  <strong class="font-semibold text-ink">Planning estimate.</strong>
  Personal ceilings account for expenses, savings, and a buffer, capped at 30% of gross pay. Modeled take-home
  uses estimated 2026 taxes for a single filer taking the standard deduction. The rent figure ({rentLabel})
  is market context, not a lease quote.
  <a
    class="font-semibold whitespace-nowrap text-accent underline underline-offset-2 hover:text-accent-deep"
    href="#sources">See methods and sources</a
  >.
</aside>
