<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  let { children }: { children?: Snippet } = $props();

  let root: HTMLElement;

  function focusCalculator() {
    const cityInput = document.querySelector<HTMLInputElement>('#city-input');
    if (!cityInput) return;

    const bounds = cityInput.getBoundingClientRect();
    const isVisible = bounds.top >= 0 && bounds.bottom <= window.innerHeight;

    cityInput.focus({ preventScroll: true });
    if (!isVisible) cityInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cleanup = () => {};

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ default: gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const context = gsap.context(() => {
          gsap.from('[data-hero-line]', {
            yPercent: 110,
            duration: 1,
            stagger: 0.1,
            ease: 'power4.out'
          });

          gsap.fromTo(
            '[data-reveal-word]',
            { opacity: 0.14 },
            {
              opacity: 1,
              stagger: 0.08,
              scrollTrigger: {
                trigger: '[data-reveal-copy]',
                start: 'top 82%',
                end: 'bottom 58%',
                scrub: 0.7
              }
            }
          );

          gsap.utils.toArray<HTMLElement>('[data-stack-card]').forEach((card, index) => {
            gsap.from(card, {
              y: 56 + index * 20,
              scale: 0.94,
              opacity: 0,
              scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                end: 'top 68%',
                scrub: 0.65
              }
            });
          });
        });

        cleanup = () => context.revert();
      }
    );

    return () => cleanup();
  });
</script>

<article bind:this={root} aria-label="Start a rent plan" class="min-w-0">
  <section
    data-editorial-hero
    class="relative min-h-136 overflow-hidden rounded-2xl border border-line-strong p-7 shadow-card md:p-10"
  >
    <div data-halftone-field aria-hidden="true"></div>
    <p class="max-w-md text-meta font-semibold tracking-[0.14em] text-accent uppercase">
      Plan the move before the listings
    </p>
    <h1
      class="mt-8 max-w-6xl text-[clamp(3.4rem,7.2vw,7.25rem)] leading-[0.88] font-semibold tracking-[-0.065em] text-ink"
    >
      <span class="mb-[-0.08em] block overflow-hidden pb-[0.08em]"
        ><span data-hero-line class="block">Know what rent fits</span></span
      >
      <span class="mb-[-0.08em] block overflow-hidden pb-[0.08em]"
        ><span data-hero-line class="block font-normal">before you move.</span></span
      >
    </h1>
    <p class="mt-8 max-w-xl text-[1.05rem]/7 text-ink md:ml-[18%]">
      Turn a salary offer and a city into a practical rent target, then set it beside the local
      market.
    </p>
    <button
      type="button"
      onclick={focusCalculator}
      class="group mt-8 inline-flex min-h-13 items-center gap-12 rounded-full bg-ink px-5 py-3 text-base font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:ml-[18%]"
    >
      Build my rent plan
      <span
        aria-hidden="true"
        class="text-xl transition-transform duration-300 group-hover:translate-x-1">→</span
      >
    </button>
  </section>

  <div class="mt-8 md:mt-10">
    {@render children?.()}
  </div>

  <section class="py-28 md:py-40" aria-labelledby="decision-heading">
    <h2
      id="decision-heading"
      class="max-w-5xl text-[clamp(2.25rem,5vw,5rem)] leading-[0.98] tracking-tighter"
    >
      <span data-reveal-copy>
        {#each 'One input becomes a decision you can explain.'.split(' ') as word (word)}
          <span data-reveal-word class="inline-block">{word}&nbsp;</span>
        {/each}
      </span>
    </h2>

    <div
      class="mt-16 grid grid-flow-dense grid-cols-1 border-t border-l border-line-strong md:grid-cols-6 md:grid-rows-2"
    >
      <article
        data-stack-card
        class="group relative overflow-hidden border-r border-b border-line-strong p-7 md:col-span-3 md:row-span-2 md:min-h-96 md:p-10"
      >
        <div data-halftone-orbit aria-hidden="true"></div>
        <h3
          class="relative max-w-sm text-[clamp(2rem,4vw,4.25rem)] leading-[0.95] tracking-tighter"
        >
          A rent target grounded in your offer.
        </h3>
        <p class="relative mt-8 max-w-sm text-body text-muted">
          See the 30% guideline beside estimated take-home pay, not in isolation.
        </p>
      </article>
      <article
        data-stack-card
        class="group border-r border-b border-line-strong p-7 md:col-span-3 md:p-9"
      >
        <h3 class="text-title">Local context</h3>
        <p class="mt-3 max-w-md text-body text-muted">
          Compare the target with current city rent estimates and their source period.
        </p>
      </article>
      <article
        data-stack-card
        class="group border-r border-b border-line-strong p-7 md:col-span-2 md:p-9"
      >
        <h3 class="text-title">Nearby options</h3>
        <p class="mt-3 text-sm/relaxed text-muted">
          Find places close enough to keep the move practical.
        </p>
      </article>
      <article data-stack-card class="group bg-ink p-7 text-canvas md:col-span-1 md:p-9">
        <h3 class="text-title">Compare</h3>
        <p class="mt-3 text-sm/relaxed text-canvas/70">Put up to five offers side by side.</p>
      </article>
    </div>
  </section>
</article>
