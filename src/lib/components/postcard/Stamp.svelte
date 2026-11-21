<script lang="ts">
  import { ringDash, type Fit } from '$lib/postcard';
  import { money } from '$lib/format';

  /**
   * The perforated stamp. In `share` mode the ring fills with how much of the
   * ceiling a rent uses and the paper colour gives the verdict: pink fits,
   * white is tight, slate is over. In `ceiling` mode it shows the ceiling itself.
   */
  let {
    fit = 'unknown',
    share = null,
    label,
    size = 156,
    ceiling = null,
    description
  }: {
    fit?: Fit;
    share?: number | null;
    label?: string;
    size?: number;
    ceiling?: number | null;
    description: string;
  } = $props();

  const id = $props.id();
  const holes = [
    [130, 5],
    [130, 255],
    [5, 130],
    [255, 130],
    [42, 42],
    [218, 42],
    [42, 218],
    [218, 218],
    [82, 15],
    [178, 15],
    [82, 245],
    [178, 245],
    [15, 82],
    [15, 178],
    [245, 82],
    [245, 178]
  ];
  let text = $derived(label ?? (share == null ? '—' : `${Math.round(share * 100)}%`));
  let fontSize = $derived(text.length > 4 ? 42 : 50);
</script>

<svg
  viewBox="0 0 260 260"
  width={size}
  height={size}
  role="img"
  aria-label={description}
  class="pc-stamp"
  data-fit={ceiling != null ? 'ceiling' : fit}
>
  <defs>
    <mask id="{id}-perf" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="260">
      <rect width="260" height="260" fill="#fff" />
      <g fill="#000">
        {#each holes as [cx, cy] (`${cx}-${cy}`)}<circle {cx} {cy} r="8.5" />{/each}
      </g>
    </mask>
  </defs>
  {#if ceiling != null}
    <circle cx="130" cy="130" r="125" fill="var(--pink)" mask="url(#{id}-perf)" />
    <circle cx="130" cy="130" r="92" fill="none" stroke="var(--navy)" stroke-width="5" />
    <circle
      cx="130"
      cy="130"
      r="80"
      fill="none"
      stroke="var(--navy)"
      stroke-width="2"
      stroke-dasharray="4 6"
    />
    <text
      x="130"
      y="128"
      text-anchor="middle"
      font-family="Bricolage Grotesque, sans-serif"
      font-weight="800"
      font-size={money(ceiling).length > 6 ? 38 : 46}
      fill="var(--navy)">{money(ceiling)}</text
    >
    <text
      x="130"
      y="160"
      text-anchor="middle"
      font-family="Instrument Sans, sans-serif"
      font-weight="600"
      font-size="20"
      fill="var(--navy)">a month</text
    >
  {:else}
    {#if fit === 'within'}
      <circle cx="130" cy="130" r="125" fill="var(--pink)" mask="url(#{id}-perf)" />
    {:else if fit === 'near'}
      <circle
        cx="130"
        cy="130"
        r="122"
        fill="#fff"
        stroke="var(--navy)"
        stroke-width="6"
        mask="url(#{id}-perf)"
      />
    {:else if fit === 'above'}
      <circle cx="130" cy="130" r="125" fill="var(--slate)" mask="url(#{id}-perf)" />
    {:else}
      <circle
        cx="130"
        cy="130"
        r="122"
        fill="#fff"
        stroke="var(--slate-ink)"
        stroke-width="4"
        stroke-dasharray="10 8"
        mask="url(#{id}-perf)"
      />
    {/if}
    <circle
      cx="130"
      cy="130"
      r="86"
      fill="none"
      stroke="var(--navy)"
      stroke-opacity={fit === 'above' ? 1 : 0.18}
      stroke-width="22"
    />
    {#if fit !== 'above' && share != null}
      <circle
        cx="130"
        cy="130"
        r="86"
        fill="none"
        stroke="var(--navy)"
        stroke-width="22"
        stroke-dasharray={ringDash(share)}
        transform="rotate(-90 130 130)"
        class="pc-stamp-ring"
      />
    {/if}
    <text
      x="130"
      y="146"
      text-anchor="middle"
      font-family="Bricolage Grotesque, sans-serif"
      font-weight="800"
      font-size={fontSize}
      fill="var(--navy)">{text}</text
    >
  {/if}
</svg>

<style>
  .pc-stamp {
    display: block;
    flex: none;
  }
  .pc-stamp-ring {
    transition: stroke-dasharray 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
