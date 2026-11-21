<script lang="ts">
  import type { HousingChoice } from '$lib/planning';

  let {
    value,
    onchange,
    label = 'Housing'
  }: { value: HousingChoice; onchange: (value: HousingChoice) => void; label?: string } = $props();

  const choices: { value: HousingChoice; label: string }[] = [
    { value: '1br', label: '1 bed' },
    { value: '2br', label: '2 bed' },
    { value: 'shared-2br', label: 'Shared 2 bed' }
  ];
</script>

<div class="pc-seg" role="group" aria-label={label}>
  {#each choices as choice (choice.value)}
    <button
      type="button"
      aria-pressed={value === choice.value}
      onclick={() => value !== choice.value && onchange(choice.value)}>{choice.label}</button
    >
  {/each}
</div>
