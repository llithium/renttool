<script lang="ts">
  import { normalizeMonthlyAmount } from '$lib/planning';
  let {
    id,
    label,
    value,
    onchange,
    placeholder = 'Optional',
    hint,
    monthly = true
  }: {
    id: string;
    label: string;
    value: number | null;
    onchange: (value: number | null) => void;
    placeholder?: string;
    hint?: string;
    monthly?: boolean;
  } = $props();
  let error = $state('');
  function input(event: Event) {
    const field = event.currentTarget as HTMLInputElement;
    if (field.value === '' && !field.validity.badInput) {
      error = '';
      onchange(null);
      return;
    }
    const amount = normalizeMonthlyAmount(field.valueAsNumber);
    error = amount == null || !field.validity.valid ? 'Enter an amount from $0 to $1,000,000.' : '';
    if (!error) onchange(amount);
  }
</script>

<div>
  <label for={id} class="mb-2 block text-label text-muted">{label}</label>
  <div
    class="flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 focus-within:border-accent"
  >
    <span aria-hidden="true" class="text-muted">$</span>
    <input
      {id}
      type="number"
      min="0"
      max="1000000"
      step="0.01"
      inputmode="decimal"
      {value}
      {placeholder}
      oninput={input}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      class="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink tabular-nums outline-none"
    />
    {#if monthly}<span class="text-meta text-muted">/mo</span>{/if}
  </div>
  {#if error}<p id={`${id}-error`} role="status" class="mt-1 text-meta text-red">{error}</p>
  {:else if hint}<p id={`${id}-hint`} class="mt-1 text-meta text-muted">{hint}</p>{/if}
</div>
