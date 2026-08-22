<script lang="ts">
  const SLIDER_MIN = 30000;
  const SLIDER_MAX = 200000;

  /** The slider owns its own range; it and the number field share the plan salary. */
  let { value, oninput }: { value: number | null; oninput: (event: Event) => void } = $props();

  let clamped = $derived(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value ?? SLIDER_MIN)));
  let fill = $derived(Math.round(((clamped - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100));
</script>

<div class="relative flex h-6 items-center">
  <div
    aria-hidden="true"
    class="absolute inset-x-0 h-1 overflow-hidden rounded-full bg-line-strong"
  >
    <span
      class="motion-fill block size-full origin-left rounded-full bg-accent"
      style:--motion-fill={fill / 100}
    ></span>
  </div>
  <input
    type="range"
    min={SLIDER_MIN}
    max={SLIDER_MAX}
    step="1000"
    value={clamped}
    aria-label="Annual salary slider"
    {oninput}
    class="relative z-10 w-full cursor-pointer appearance-none bg-transparent"
  />
</div>
<!-- The endpoints name the available range; the control itself already explains how to adjust it. -->
<div class="mt-1 flex justify-between text-xs text-muted tabular-nums">
  <span>$30k</span><span>$200k</span>
</div>

<style>
  input::-webkit-slider-runnable-track {
    height: 4px;
    background: transparent;
  }
  input::-moz-range-track {
    height: 4px;
    background: transparent;
  }
  input::-moz-range-progress {
    height: 4px;
    background: transparent;
  }
  input::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -10px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--card);
    box-shadow: var(--elevation-card);
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  input:hover::-webkit-slider-thumb,
  input:active::-webkit-slider-thumb {
    transform: scale(1.12);
  }
  input::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    border: 3px solid var(--card);
    box-shadow: var(--elevation-card);
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  input:hover::-moz-range-thumb,
  input:active::-moz-range-thumb {
    transform: scale(1.12);
  }
</style>
