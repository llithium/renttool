<script lang="ts">
  /**
   * The salary field, shared by the city view (`lg`) and each comparison entry
   * (`md`). The parent owns parsing and validation; this
   * component owns the field chrome and error wiring.
   */
  let {
    id,
    label,
    value,
    error = '',
    size = 'lg',
    ariaLabel,
    detail,
    oninput,
    onblur,
    onkeydown,
    class: className = ''
  }: {
    id: string;
    label: string;
    value: string;
    error?: string;
    size?: 'lg' | 'md';
    ariaLabel?: string;
    detail?: string;
    oninput: (event: Event) => void;
    onblur?: () => void;
    onkeydown?: (event: KeyboardEvent) => void;
    class?: string;
  } = $props();
</script>

<div class={className}>
  <div class="mb-2 flex items-baseline justify-between gap-3 text-muted">
    <label for={id} class="text-label">{label}</label>
    {#if detail}<span class="text-meta tabular-nums">{detail}</span>{/if}
  </div>
  <div
    class="flex items-baseline gap-0.5 border-b-2 focus-within:border-accent {error
      ? 'border-red'
      : 'border-line-strong'}"
  >
    <span class="text-muted {size === 'lg' ? 'text-3xl' : 'text-lg'}">$</span>
    <input
      {id}
      type="text"
      inputmode="numeric"
      aria-label={ariaLabel}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${id}-error` : undefined}
      {value}
      {oninput}
      {onblur}
      {onkeydown}
      class="w-full min-w-0 flex-1 border-0 bg-transparent py-0.5 font-semibold tracking-tight text-ink tabular-nums outline-none placeholder:text-faint {size ===
      'lg'
        ? 'text-[clamp(2rem,3vw,2.75rem)]'
        : 'text-2xl'}"
      placeholder="e.g. 65,000"
    />
  </div>
  {#if error}
    <span id={`${id}-error`} class="mt-2 block text-meta text-red">{error}</span>
  {/if}
</div>
