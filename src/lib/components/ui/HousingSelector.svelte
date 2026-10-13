<script lang="ts">
  import Select from './Select.svelte';
  import { HOUSING_CHOICES, type HousingChoice } from '$lib/planning';
  let {
    value,
    onchange,
    id = 'housing'
  }: { value: HousingChoice; onchange: (value: HousingChoice) => void; id?: string } = $props();
</script>

<div>
  <Select
    {id}
    label="Housing setup"
    {value}
    {onchange}
    options={(Object.keys(HOUSING_CHOICES) as HousingChoice[]).map((value) => ({
      value,
      label: HOUSING_CHOICES[value]
    }))}
  />
  {#if value === 'shared-2br'}
    <p class="mt-2 text-meta text-muted">Two people split the rent equally.</p>
  {/if}
</div>
