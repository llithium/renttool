<script lang="ts">
  import { createPreviewState } from '$lib/preview/state.svelte';
  import { CITY_NAMES, FIT_TEXT, cityHue, compact, type NearbyView } from '$lib/preview/model';
  import { computeBudget } from '$lib/budget';
  import { money } from '$lib/format';
  import PreviewMap from '$lib/preview/PreviewMap.svelte';
  import PreviewBar from '$lib/preview/PreviewBar.svelte';
  import type { HousingChoice } from '$lib/planning';

  const state = createPreviewState();
  let v = $derived(state.view);
  let hue = $derived(v ? cityHue(v.name) : 260);
  let gross = $derived(v ? v.salary / 12 : 1);
  const pct = (n: number) => `${Math.max(0, (n / gross) * 100).toFixed(2)}%`;

  // Same salary in each nearby town (state taxes follow the town's state).
  let rows = $derived.by(() => {
    if (!v) return [];
    const self = {
      name: v.name,
      city: v.city,
      rent: v.rent,
      tax: v.taxesMonthly,
      left: v.leftover,
      fit: v.fit,
      miles: 0,
      bearing: '',
      here: true
    };
    const others = v.nearby
      .filter((n) => n.rent != null)
      .map((n) => {
        const b = computeBudget(v!.salary, { name: n.name, state: n.state });
        const tax = gross - b.takeHomeMonthly;
        return {
          name: n.name,
          city: n.city,
          rent: n.rent,
          tax,
          left: b.takeHomeMonthly - (n.rent ?? 0),
          fit: n.fit,
          miles: n.miles,
          bearing: n.bearing,
          here: false
        };
      });
    return [self, ...others].sort((a, b) => (b.left ?? 0) - (a.left ?? 0));
  });

  function pill(p: NearbyView) {
    if (p.rent == null) return `<span class="pk-town">${p.city}</span>`;
    return `<span class="pk-pill pk-${p.fit}">${p.city} <b>${money(p.rent)}</b></span>`;
  }

  function pickCity(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (CITY_NAMES.includes(value)) state.set({ city: value });
  }
</script>

<svelte:head>
  <title>{v ? v.name : 'City'} · Paycheck preview</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="page" style="--hue:{hue}">
  <header class="bar">
    <span class="mark">Rent Tool</span>
  </header>

  {#if v}
    <h1 class="sentence">
      A month in
      <input
        class="city"
        list="pk-cities"
        value={state.city}
        onchange={pickCity}
        aria-label="City"
        spellcheck="false"
        style="width:{Math.max(state.city.length, 6) + 0.5}ch"
      />
      on
      <input
        class="pay"
        inputmode="numeric"
        aria-label="Annual salary"
        value={money(state.salary)}
        onchange={(e) => {
          const n = Number(e.currentTarget.value.replace(/[^0-9]/g, ''));
          if (n >= 10000) state.set({ salary: n });
        }}
      />
      a year, renting
      <select
        aria-label="Home"
        value={state.housing}
        onchange={(e) => state.set({ housing: e.currentTarget.value as HousingChoice })}
      >
        <option value="1br">a 1 bedroom</option>
        <option value="2br">a 2 bedroom</option>
        <option value="shared-2br">half a 2 bedroom</option>
      </select>
    </h1>
    <datalist id="pk-cities">
      {#each CITY_NAMES as name (name)}<option value={name}></option>{/each}
    </datalist>

    <section class="month" aria-label="Where {money(gross)} a month goes">
      <div class="strip">
        <div
          class="seg rent pk-{v.fit}"
          class:nophoto={!v.image}
          style="flex-basis:{pct(v.rent ?? 0)}"
        >
          {#if v.image}
            <img
              src={v.image.url}
              alt={v.image.alt}
              style="object-position:50% {v.image.focusY ?? 50}%"
            />
          {:else}
            <span class="initials" aria-hidden="true">{v.city.slice(0, 2)}</span>
          {/if}
          <div class="seg-text">
            <span class="amt">{money(v.rent)}</span>
            <span class="what">Rent in {v.city}</span>
          </div>
        </div>
        <div class="seg left" style="flex-basis:{pct(v.leftover ?? 0)}">
          <div class="seg-text">
            <span class="amt">{money(v.leftover)}</span>
            <span class="what">Yours after rent</span>
          </div>
        </div>
        <div class="seg tax" style="flex-basis:{pct(v.taxesMonthly)}">
          <div class="seg-text">
            <span class="amt">{money(v.taxesMonthly)}</span>
            <span class="what">Taxes</span>
          </div>
        </div>
        <div class="limit" style="left:30%">
          <span>30% line · {money(v.ceiling)}</span>
        </div>
      </div>
      <div class="readout">
        <p class="verdict pk-{v.fit}">
          {FIT_TEXT[v.fit]}.
          {#if v.rentShare != null}
            Rent takes {Math.round(v.rentShare * 100)}% of your gross pay{v.margin != null &&
            v.margin < 0
              ? `; you'd want about ${money(v.salaryNeeded)} a year here.`
              : `, ${money(v.margin)} under the 30% line.`}
          {/if}
        </p>
        <p class="aside">
          {money(gross)} a month before taxes.
          {#if v.yoy != null}Rent here is {v.yoy < 0 ? 'down' : 'up'}
            {Math.abs(v.yoy)}% from last year.{/if}
        </p>
      </div>
    </section>

    <section class="nearby">
      <div class="compare">
        <h2>The same paycheck, nearby</h2>
        <p class="hint">Sorted by what's left after rent and taxes.</p>
        <ol>
          {#each rows as r (r.name)}
            <li class:here={r.here}>
              <div class="row-head">
                {#if r.here}
                  <b>{r.city}</b>
                {:else}
                  <button onclick={() => state.set({ city: r.name })}>{r.city}</button>
                  <span class="dist">{r.miles} mi {r.bearing}</span>
                {/if}
                <span class="row-left">{money(r.left)} left</span>
              </div>
              <div class="mini" aria-hidden="true">
                <span class="m-rent pk-{r.fit}" style="flex-basis:{pct(r.rent ?? 0)}"></span>
                <span class="m-left" style="flex-basis:{pct(r.left ?? 0)}"></span>
                <span class="m-tax" style="flex-basis:{pct(r.tax)}"></span>
                <i style="left:30%"></i>
              </div>
            </li>
          {/each}
        </ol>
      </div>
      <div class="mapbox">
        <PreviewMap
          view={v}
          tiles="voyager"
          marker={pill}
          center={(c) => `<span class="pk-here">${c.city}</span>`}
          onpick={(name) => state.set({ city: name })}
        />
      </div>
    </section>

    <section class="context">
      <h2>Who lives in {v.city}</h2>
      {#if v.facts}
        <div class="income">
          <div class="ibar">
            <span
              class="you"
              style="width:{Math.min(
                100,
                (v.salary / Math.max(v.salary, v.facts.householdIncome)) * 100
              )}%"
            >
              You {money(v.salary)}
            </span>
          </div>
          <div class="ibar">
            <span
              class="them"
              style="width:{Math.min(
                100,
                (v.facts.householdIncome / Math.max(v.salary, v.facts.householdIncome)) * 100
              )}%"
            >
              Typical household {money(v.facts.householdIncome)}
            </span>
          </div>
        </div>
        <dl>
          <div>
            <dt>People</dt>
            <dd>{v.pop ? compact(v.pop) : '—'}</dd>
          </div>
          <div>
            <dt>Commute</dt>
            <dd>
              {v.facts.commuteMinutes != null ? `${Math.round(v.facts.commuteMinutes)} min` : '—'}
            </dd>
          </div>
          <div>
            <dt>Renting</dt>
            <dd>{v.facts.renterShare != null ? `${Math.round(v.facts.renterShare)}%` : '—'}</dd>
          </div>
          <div>
            <dt>Vacant rentals</dt>
            <dd>{v.facts.rentalVacancy != null ? `${v.facts.rentalVacancy}%` : '—'}</dd>
          </div>
        </dl>
      {:else}
        <p class="hint">No Census profile for this place yet.</p>
      {/if}
    </section>

    <nav class="out" aria-label="Elsewhere">
      <div>
        <h2>Get to know it</h2>
        <a href={v.links.wikipedia} target="_blank" rel="noopener">{v.city} on Wikipedia</a>
        <a href={v.links.maps} target="_blank" rel="noopener">{v.city} on Google Maps</a>
      </div>
      <div>
        <h2>See real listings</h2>
        {#each v.links.search as link (link.provider)}
          <a href={link.url} target="_blank" rel="noopener"
            >{link.providerName}{link.capDescription ? `, ${link.capDescription}` : ''}</a
          >
        {/each}
      </div>
    </nav>

    <footer class="foot">
      {#if v.image}Photo: <a href={v.image.photographerUrl}>{v.image.photographerName}</a>.
      {/if}
      Rent: Apartment List estimated median, Sept 2026. Taxes are modeled federal, FICA, state and local.
    </footer>
  {/if}
</div>

<PreviewBar {state} current="paycheck" />

<style>
  .page {
    --canvas: #f2f4f7;
    --ink: #17151f;
    --muted: #5f6070;
    --left: #8fe3c0;
    --tax: #c9cdd6;
    --over: #ff6a4d;
    --near: #ffc65c;
    min-height: 100vh;
    padding: 0 clamp(16px, 4vw, 56px) 96px;
    background: var(--canvas);
    color: var(--ink);
    font:
      400 16px/1.5 'Schibsted Grotesk',
      system-ui,
      sans-serif;
  }
  .bar {
    padding: 20px 0 0;
  }
  .mark {
    font-weight: 900;
    font-size: 18px;
    letter-spacing: -0.02em;
  }
  .sentence {
    max-width: 22em;
    margin: 28px 0 28px;
    font-size: clamp(30px, 4.4vw, 58px);
    line-height: 1.12;
    font-weight: 500;
    letter-spacing: -0.025em;
  }
  .sentence input,
  .sentence select {
    font: inherit;
    font-weight: 800;
    letter-spacing: inherit;
    color: var(--ink);
    background: transparent;
    border: 0;
    border-bottom: 0.08em solid var(--ink);
    padding: 0;
    border-radius: 0;
  }
  .sentence .pay {
    width: 4.2em;
  }
  .sentence select {
    appearance: none;
    cursor: pointer;
  }
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid #5b5bd6;
    outline-offset: 3px;
  }

  .strip {
    position: relative;
    display: flex;
    height: clamp(240px, 38vh, 400px);
    gap: 4px;
  }
  .seg {
    position: relative;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    transition: flex-basis 420ms cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .seg-text {
    position: absolute;
    left: 14px;
    bottom: 12px;
    right: 10px;
  }
  .amt {
    display: block;
    font-size: clamp(22px, 2.6vw, 36px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .what {
    font-size: 14px;
    font-weight: 500;
  }
  .rent {
    background: hsl(var(--hue) 45% 30%);
    color: #fff;
  }
  .rent img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .rent::after {
    content: '';
    position: absolute;
    inset: 40% 0 0;
    background: linear-gradient(transparent, rgb(0 0 0 / 0.6));
  }
  .rent .seg-text {
    z-index: 1;
  }
  .rent.nophoto {
    background:
      radial-gradient(circle at 20% 10%, hsl(var(--hue) 60% 46%), transparent 60%),
      hsl(var(--hue) 45% 28%);
  }
  .initials {
    position: absolute;
    top: -0.12em;
    left: 6px;
    font-size: clamp(120px, 16vw, 240px);
    font-weight: 900;
    letter-spacing: -0.06em;
    line-height: 1;
    color: hsl(var(--hue) 55% 62% / 0.55);
  }
  .rent.pk-above {
    box-shadow: inset 0 -10px 0 var(--over);
  }
  .left {
    background: var(--left);
  }
  .tax {
    background: var(--tax);
  }
  .tax .what,
  .left .what {
    color: rgb(23 21 31 / 0.75);
  }
  .limit {
    position: absolute;
    top: -10px;
    bottom: -30px;
    border-left: 2px dashed var(--ink);
    pointer-events: none;
  }
  .limit span {
    position: absolute;
    bottom: 4px;
    left: 6px;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .readout {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 24px;
    margin-top: 42px;
    align-items: start;
  }
  .verdict {
    margin: 0;
    font-size: clamp(20px, 2vw, 26px);
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.01em;
    max-width: 30em;
  }
  .verdict.pk-above {
    color: #c8361c;
  }
  .aside {
    margin: 4px 0 0;
    color: var(--muted);
  }

  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .hint {
    margin: 4px 0 18px;
    color: var(--muted);
    font-size: 14px;
  }
  .nearby {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(24px, 4vw, 56px);
    margin-top: 80px;
  }
  .compare ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .compare li {
    padding: 8px 0 10px;
  }
  .compare li.here {
    padding: 10px 12px 12px;
    margin: 0 -12px;
    background: #fff;
  }
  .row-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 6px;
  }
  .row-head button {
    font: inherit;
    font-weight: 700;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .dist {
    color: var(--muted);
    font-size: 13px;
  }
  .row-left {
    margin-left: auto;
    font-weight: 700;
  }
  .mini {
    position: relative;
    display: flex;
    gap: 2px;
    height: 14px;
  }
  .mini span {
    transition: flex-basis 420ms cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .m-rent {
    background: hsl(var(--hue) 45% 30%);
  }
  .m-rent.pk-above {
    background: var(--over);
  }
  .m-rent.pk-near {
    background: #b9821a;
  }
  .m-left {
    background: var(--left);
  }
  .m-tax {
    background: var(--tax);
  }
  .mini i {
    position: absolute;
    top: -3px;
    bottom: -3px;
    border-left: 1.5px dashed var(--ink);
  }
  .mapbox {
    min-height: 460px;
    background: #e3e6ea;
  }
  .mapbox :global(.pk-pill) {
    --c: hsl(var(--hue) 45% 30%);
    display: inline-block;
    transform: translate(-50%, -50%);
    padding: 4px 9px;
    border-radius: 999px;
    background: #fff;
    color: var(--ink);
    font:
      500 12px/1 'Schibsted Grotesk',
      sans-serif;
    white-space: nowrap;
    box-shadow: inset 0 0 0 2px var(--c);
    cursor: pointer;
  }
  .mapbox :global(.pk-pill b) {
    font-weight: 800;
  }
  .mapbox :global(.pk-pill.pk-above) {
    --c: var(--over);
  }
  .mapbox :global(.pk-pill.pk-near) {
    --c: #b9821a;
  }
  .mapbox :global(.pk-town) {
    display: inline-block;
    transform: translate(-50%, -50%);
    font:
      500 11px 'Schibsted Grotesk',
      sans-serif;
    color: var(--muted);
    white-space: nowrap;
  }
  .mapbox :global(.pk-here) {
    display: inline-block;
    transform: translate(-50%, -50%);
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font:
      800 14px/1 'Schibsted Grotesk',
      sans-serif;
    white-space: nowrap;
  }

  .context {
    margin-top: 80px;
    max-width: 60rem;
  }
  .income {
    margin: 18px 0 8px;
    display: grid;
    gap: 6px;
  }
  .ibar span {
    display: block;
    padding: 8px 12px;
    font-weight: 700;
    white-space: nowrap;
    transition: width 420ms cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .you {
    background: var(--ink);
    color: #fff;
  }
  .them {
    background: hsl(var(--hue) 35% 82%);
  }
  .context dl {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin: 20px 0 0;
  }
  .context dt {
    font-size: 13px;
    color: var(--muted);
  }
  .context dd {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .out {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 72px;
    padding-top: 24px;
    border-top: 4px solid var(--ink);
  }
  .out h2 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  .out a {
    display: block;
    padding: 6px 0;
    color: var(--ink);
    font-weight: 600;
    font-size: 18px;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
  .foot {
    margin-top: 40px;
    font-size: 12px;
    color: var(--muted);
  }
  .foot a {
    color: inherit;
  }

  @media (max-width: 820px) {
    .strip {
      height: 220px;
    }
    .seg-text {
      left: 8px;
    }
    .what {
      font-size: 12px;
    }
    .readout,
    .nearby,
    .out {
      grid-template-columns: 1fr;
    }
    .context dl {
      grid-template-columns: 1fr 1fr;
    }
    .mapbox {
      min-height: 340px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .seg,
    .mini span,
    .ibar span {
      transition: none;
    }
  }
</style>
