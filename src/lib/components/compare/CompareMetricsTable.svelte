<script lang="ts">
  import type { ComparisonCity, ComparisonView } from '$lib/compare/decision';

  let {
    analysis,
    hrefForCity
  }: { analysis: ComparisonView; hrefForCity: (city: ComparisonCity) => string } = $props();
</script>

<div>
  <div class="mb-3">
    <p class="text-label text-ink">Affordability first</p>
  </div>
  <div class="overflow-x-auto">
    <!-- Cell padding and rules are uniform across the table, so they ride on the
       row and body; alignment and stickiness vary per column. -->
    <table class="w-full min-w-170 border-collapse text-sm">
      <thead>
        <tr
          class="[&>th]:border-b [&>th]:border-line [&>th]:px-4 [&>th]:py-3 [&>th]:align-top [&>th]:text-xs [&>th]:tracking-wider [&>th]:text-muted [&>th]:uppercase"
        >
          <!-- The metric column stays put while the city columns scroll sideways. -->
          <th class="sticky left-0 z-10 min-w-46 bg-canvas text-left">Metric</th>
          {#each analysis.entries as entry (entry.city.name)}
            <th class="text-right">
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
            <th class="sticky left-0 z-10 min-w-46 bg-canvas text-left font-semibold text-muted">
              {metric.label}
            </th>
            {#each analysis.entries as entry, index (entry.city.name)}
              {@const cell = entry.metrics[metric.key]}
              <td
                data-tone={cell.tone}
                title={cell.tone === 'best'
                  ? 'Best in comparison'
                  : cell.tone === 'worst'
                    ? 'Worst in comparison'
                    : undefined}
                class="relative text-right tabular-nums {cell.tone
                  ? 'border-b-transparent'
                  : ''} {cell.tone === 'best'
                  ? 'text-green'
                  : cell.tone === 'worst'
                    ? 'text-red'
                    : ''}"
              >
                {#key cell.value}<span class="motion-value">{cell.value}</span>{/key}
                {#if cell.tone}
                  <!-- Best/worst is called out with a rule under the cell rather
                     than a fill, so the number stays the loudest thing in the row.
                     It runs to the table edge on the outer columns. -->
                  <span
                    class="absolute bottom-0 h-0.5 {cell.tone === 'best'
                      ? 'bg-green'
                      : 'bg-red'} {index === 0 ? 'left-0' : 'left-1.5'} {index ===
                    analysis.entries.length - 1
                      ? 'right-0'
                      : 'right-1.5'}"
                  ></span>
                  <span
                    class="mt-1 block text-meta font-semibold {cell.tone === 'best'
                      ? 'text-green'
                      : 'text-red'}"
                  >
                    {cell.toneLabel}
                  </span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
        <tr>
          <th class="sticky left-0 z-10 min-w-46 bg-canvas text-left font-semibold text-muted">
            Income tax context
          </th>
          {#each analysis.entries as entry (entry.city.name)}
            <td class="min-w-44 text-right text-xs text-muted">{entry.taxContext}</td>
          {/each}
        </tr>
        {#each analysis.cityContextMetrics as metric (metric.key)}
          <tr>
            <th class="sticky left-0 z-10 min-w-46 bg-canvas text-left font-semibold text-muted">
              {metric.label}
            </th>
            {#each analysis.entries as entry, index (entry.city.name)}
              {@const cell = entry.metrics[metric.key]}
              <td
                data-tone={cell.tone}
                class="relative text-right tabular-nums {cell.tone === 'best'
                  ? 'text-green'
                  : cell.tone === 'worst'
                    ? 'text-red'
                    : ''}"
              >
                {#key cell.value}<span class="motion-value">{cell.value}</span>{/key}
                {#if cell.tone}
                  <span
                    class="absolute bottom-0 h-0.5 {cell.tone === 'best'
                      ? 'bg-green'
                      : 'bg-red'} {index === 0 ? 'left-0' : 'left-1.5'} {index ===
                    analysis.entries.length - 1
                      ? 'right-0'
                      : 'right-1.5'}"
                  ></span>
                  <span
                    class="mt-1 block text-meta font-semibold {cell.tone === 'best'
                      ? 'text-green'
                      : 'text-red'}"
                  >
                    {cell.toneLabel}
                  </span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
        <tr>
          <th class="sticky left-0 z-10 min-w-46 bg-canvas text-left font-semibold text-muted">
            Rent data
          </th>
          {#each analysis.entries as entry (entry.city.name)}
            <td class="min-w-44 text-right text-xs text-muted">
              {entry.rentProvenance}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  </div>
</div>
