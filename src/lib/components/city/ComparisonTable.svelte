<script lang="ts">
  import type { City } from '$lib/types';
  import { money, pctTrend } from '$lib/format';
  import type { RentPlanPresentation } from '$lib/rentPlanPresentation.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let {
    presentation,
    class: className = ''
  }: {
    presentation: RentPlanPresentation;
    class?: string;
  } = $props();

  let cities = $derived(presentation.comparisonCities);
  let maxRent = $derived(presentation.rentTarget ?? 0);

  function cushion(c: City): number | null {
    return c.r1 != null ? maxRent - c.r1 : null;
  }
</script>

<section id="comparison-section" class={className}>
  <SectionHeading title="Compare cities">
    <div class="flex items-baseline gap-3.5">
      <span class="text-xs font-medium text-muted tabular-nums"
        >{cities.length} / {presentation.comparisonLimit}</span
      >
      <a
        href={presentation.buildHref('/compare')}
        class="text-xs font-semibold text-accent no-underline hover:text-accent-deep"
      >
        Detailed comparison →
      </a>
    </div>
  </SectionHeading>
  <p class="-mt-1.5 mb-3.5 max-w-[64ch] text-sm/normal text-muted">
    {#if presentation.salary}
      Fit measured against <strong class="font-semibold text-ink">{money(maxRent)}/mo</strong> — the same
      30% budget applies to every city, since the rule uses gross income.
    {/if}
  </p>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll the table.) -->
  <div
    class="overflow-x-auto rounded-sm"
    role="region"
    aria-label="City rent comparison; scroll horizontally for more"
    tabindex="0"
  >
    <!-- Cell padding and rules are uniform down the table, so they ride on the
         row; alignment and wrapping vary per column and stay on the cells. -->
    <table class="w-full min-w-136 border-collapse text-sm">
      <thead>
        <tr
          class="[&>th]:border-b-2 [&>th]:border-line-strong [&>th]:px-3 [&>th]:py-2 [&>th]:text-xs [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted"
        >
          <th class="text-left">City</th>
          <th class="text-right">1BR</th>
          <th class="text-right">2BR</th>
          <th class="text-right">Trend</th>
          <th class="text-center">Fits?</th>
          <th class="text-left">Income tax</th>
          <th aria-label="Remove"></th>
        </tr>
      </thead>
      <tbody>
        {#each cities as c (c.name)}
          {@const cu = cushion(c)}
          <tr
            class="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-2.5 {c.name ===
            presentation.selectedName
              ? '[&>td]:bg-accent-soft'
              : ''}"
          >
            <td class="whitespace-nowrap">
              <button
                onclick={() => presentation.selectComparisonCity(c.name)}
                class="cursor-pointer border-0 bg-transparent p-0 text-base font-semibold tracking-tight text-accent"
              >
                {c.name}
              </button>
            </td>
            <td class="text-right font-semibold whitespace-nowrap tabular-nums">{money(c.r1)}</td>
            <td class="text-right whitespace-nowrap tabular-nums">{money(c.r2)}</td>
            <td
              class="text-right whitespace-nowrap tabular-nums {c.yoy == null || c.yoy === 0
                ? ''
                : c.yoy > 0
                  ? 'text-red'
                  : 'text-green'}"
            >
              {pctTrend(c.yoy)}
            </td>
            <td class="text-center whitespace-nowrap">
              {#if cu == null}
                <span
                  class="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-muted"
                >
                  —
                </span>
              {:else if cu >= 0}
                <span
                  class="inline-block rounded-full bg-green-soft px-2.5 py-1 text-xs font-semibold text-green"
                >
                  +{money(cu)}
                </span>
              {:else}
                <span
                  class="inline-block rounded-full bg-red-soft px-2.5 py-1 text-xs font-semibold text-red"
                >
                  {money(cu)}
                </span>
              {/if}
            </td>
            <td class="min-w-38 text-left text-xs text-muted">{c.tax}</td>
            <td class="text-right whitespace-nowrap">
              <button
                aria-label={`Remove ${c.name}`}
                onclick={() => presentation.removeComparison(c.name)}
                class="cursor-pointer rounded-md border-0 bg-transparent p-2 text-muted hover:bg-card-2 hover:text-red"
              >
                <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="m4.5 4.5 7 7m0-7-7 7"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
