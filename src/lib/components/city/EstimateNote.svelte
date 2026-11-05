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
  The {rentLabel} is market context, not a lease quote. Take-home assumes a single filer and standard
  deduction unless you enter your paycheck.
  <a
    class="font-semibold whitespace-nowrap text-accent underline underline-offset-2 hover:text-accent-deep"
    href="#sources">See methods and sources</a
  >.
</aside>
