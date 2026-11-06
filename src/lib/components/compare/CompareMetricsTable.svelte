<script lang="ts">
  import type { CommuteFilterResult, CommuteSettings } from '$lib/commute';
  import type { ComparisonView, MetricCell } from '$lib/compare/decision';
  import type { ComparisonCity } from '$lib/compare/comparisonModel';

  let {
    analysis,
    hrefForCity,
    commutes,
    commuteLoading,
    commuteSettings
  }: {
    analysis: ComparisonView;
    hrefForCity: (city: ComparisonCity) => string;
    commutes: Record<string, CommuteFilterResult | null>;
    commuteLoading: Record<string, boolean>;
    commuteSettings: Record<string, CommuteSettings>;
  } = $props();

  let scroller: HTMLDivElement | undefined = $state();
  let overflows = $state(false);
  let atStart = $state(true);
  let atEnd = $state(false);

  function updateScroll() {
    if (!scroller) return;
    overflows = scroller.scrollWidth > scroller.clientWidth + 1;
    atStart = scroller.scrollLeft < 1;
    atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
  }

  function scrollCities(direction: number) {
    if (!scroller) return;
    const column = scroller.querySelector('thead th:nth-child(2)');
    scroller.scrollBy({ left: direction * (column?.getBoundingClientRect().width ?? 176) });
  }

  $effect(() => {
    void analysis.entries.length;
    if (!scroller) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(scroller);
    updateScroll();
    return () => observer.disconnect();
  });
</script>

{#snippet metricCell(cell: MetricCell, withTitle = false)}
  <td
    data-tone={cell.tone}
    title={withTitle
      ? cell.tone === 'best'
        ? 'Best in comparison'
        : cell.tone === 'worst'
          ? 'Worst in comparison'
          : undefined
      : undefined}
    class="text-right tabular-nums {cell.tone === 'best'
      ? 'text-green'
      : cell.tone === 'worst'
        ? 'text-red'
        : ''}"
  >
    {#key cell.value}<span class="motion-value">{cell.value}</span>{/key}
    {#if cell.tone}
      <span
        class="mt-1 block text-meta font-semibold {cell.tone === 'best'
          ? 'text-green'
          : 'text-red'}"
      >
        {cell.toneLabel}
      </span>
    {/if}
  </td>
{/snippet}

<div>
  <div class="mb-3 flex items-center justify-between gap-3">
    <p class="text-label text-ink">Affordability first</p>
    {#if overflows}
      <div class="flex items-center gap-2">
        <span class="text-meta text-muted">Scroll for more cities</span>
        <button
          type="button"
          aria-label="Previous cities"
          aria-controls="comparison-table"
          disabled={atStart}
          onclick={() => scrollCities(-1)}
          class="inline-flex size-11 cursor-pointer items-center justify-center border border-line-strong text-ink disabled:cursor-default disabled:opacity-40"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          aria-label="Next cities"
          aria-controls="comparison-table"
          disabled={atEnd}
          onclick={() => scrollCities(1)}
          class="inline-flex size-11 cursor-pointer items-center justify-center border border-line-strong text-ink disabled:cursor-default disabled:opacity-40"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    {/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll the table.) -->
  <div
    id="comparison-table"
    bind:this={scroller}
    onscroll={updateScroll}
    class="overflow-x-auto border-y border-line-strong"
    role="region"
    aria-label="Full city comparison; scroll horizontally for more"
    tabindex="0"
  >
    <!-- Cell padding and rules are uniform across the table, so they ride on the
       row and body; alignment and stickiness vary per column. -->
    <table class="w-full min-w-full border-collapse text-sm">
      <thead class="sticky top-0 z-20 bg-canvas">
        <tr
          class="[&>th]:border-b [&>th]:border-line [&>th]:px-4 [&>th]:py-3 [&>th]:align-top [&>th]:text-xs [&>th]:text-muted"
        >
          <!-- The metric column stays put while the city columns scroll sideways. -->
          <th
            class="sticky left-0 z-10 min-w-28 bg-canvas text-left min-[360px]:min-w-36 sm:min-w-46"
            >Metric</th
          >
          {#each analysis.entries as entry (entry.city.name)}
            <th class="min-w-40 text-right min-[360px]:min-w-44">
              <a
                href={hrefForCity(entry.city)}
                class="text-inherit no-underline hover:text-inherit"
              >
                {entry.city.name}
              </a>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody
        class="[&_td]:border-b [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:border-line [&_th]:px-4 [&_th]:py-3 [&_th]:align-top [&_tr:last-child>*]:border-b-0"
      >
        {#each analysis.affordabilityMetrics as metric (metric.key)}
          <tr>
            <th
              class="sticky left-0 z-10 min-w-28 bg-canvas text-left font-semibold text-muted min-[360px]:min-w-36 sm:min-w-46"
            >
              {metric.label}
            </th>
            {#each analysis.entries as entry (entry.city.name)}
              {@const cell = entry.metrics[metric.key]}
              {@render metricCell(cell, true)}
            {/each}
          </tr>
        {/each}
        {#if Object.values(commuteSettings).some((settings) => settings.destination)}
          <tr>
            <th
              class="sticky left-0 z-10 min-w-28 bg-canvas text-left font-semibold text-muted min-[360px]:min-w-36 sm:min-w-46"
            >
              Drive to saved destination
            </th>
            {#each analysis.entries as entry (entry.city.name)}
              {@const settings = commuteSettings[entry.city.name]}
              {@const commute = commutes[entry.city.name]}
              {@const minutes = commute?.minutes[entry.city.name]}
              <td class="min-w-40 text-right tabular-nums min-[360px]:min-w-44">
                {minutes != null
                  ? `${minutes} min`
                  : !settings?.destination
                    ? 'No destination'
                    : commuteLoading[entry.city.name]
                      ? 'Checking…'
                      : 'Unavailable'}
                {#if settings?.destination}<span class="mt-1 block text-meta text-muted"
                    >{settings.destination.label}</span
                  >{/if}
                {#if minutes != null && commute}
                  <span
                    class="mt-1 block text-meta {minutes <= commute.maximum
                      ? 'text-green'
                      : 'text-red'}"
                    >{minutes <= commute.maximum ? 'Within' : 'Over'}
                    {commute.maximum}-minute limit</span
                  >
                {/if}
              </td>
            {/each}
          </tr>
        {/if}
        <tr>
          <th
            class="sticky left-0 z-10 min-w-28 bg-canvas text-left font-semibold text-muted min-[360px]:min-w-36 sm:min-w-46"
          >
            Income tax context
          </th>
          {#each analysis.entries as entry (entry.city.name)}
            <td class="min-w-40 text-right text-xs text-muted min-[360px]:min-w-44"
              >{entry.taxContext}</td
            >
          {/each}
        </tr>
        {#each analysis.cityContextMetrics as metric (metric.key)}
          <tr>
            <th
              class="sticky left-0 z-10 min-w-28 bg-canvas text-left font-semibold text-muted min-[360px]:min-w-36 sm:min-w-46"
            >
              {metric.label}
            </th>
            {#each analysis.entries as entry (entry.city.name)}
              {@const cell = entry.metrics[metric.key]}
              {@render metricCell(cell)}
            {/each}
          </tr>
        {/each}
        <tr>
          <th
            class="sticky left-0 z-10 min-w-28 bg-canvas text-left font-semibold text-muted min-[360px]:min-w-36 sm:min-w-46"
          >
            Rent data
          </th>
          {#each analysis.entries as entry (entry.city.name)}
            <td class="min-w-40 text-right text-xs text-muted min-[360px]:min-w-44">
              {entry.rentProvenance}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>
</div>
