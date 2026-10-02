<script lang="ts">
  import { HOUSING_CHOICES, type HousingChoice } from '$lib/planning';
  let {
    value,
    onchange,
    id = 'housing'
  }: { value: HousingChoice; onchange: (value: HousingChoice) => void; id?: string } = $props();
</script>

<div>
  <label for={id} class="mb-2 block text-label text-muted">Housing setup</label>
  <select
    {id}
    {value}
    onchange={(event) => onchange(event.currentTarget.value as HousingChoice)}
    class="min-h-11 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink"
  >
    {#each Object.entries(HOUSING_CHOICES) as [choice, label] (choice)}
      <option value={choice}>{label}</option>
    {/each}
  </select>
  {#if value === 'shared-2br'}
    <p class="mt-2 text-meta text-muted">Two people split the rent equally.</p>
  {/if}
</div>
