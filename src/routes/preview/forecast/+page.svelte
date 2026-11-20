<script lang="ts">
  import { createPreviewState } from '$lib/preview/state.svelte';
  import { CITY_NAMES, compact, type Fit, type NearbyView } from '$lib/preview/model';
  import { money } from '$lib/format';
  import PreviewMap from '$lib/preview/PreviewMap.svelte';
  import PreviewBar from '$lib/preview/PreviewBar.svelte';
  import type { HousingChoice } from '$lib/planning';

  const state = createPreviewState();
  let v = $derived(state.view);

  const CONDITION: Record<Fit, string> = {
    within: 'Clear',
    near: 'Partly cloudy',
    above: 'Stormy',
    unknown: 'No reading'
  };
  const DETAIL: Record<Fit, string> = {
    within: 'Rent sits comfortably under your limit.',
    near: 'Rent is just under your limit, with little room.',
    above: 'Rent runs over your limit.',
    unknown: 'No rent estimate for this place.'
  };

  const ICONS: Record<Fit, string> = {
    within:
      '<circle cx="32" cy="32" r="12" fill="#FFD23F"/><g stroke="#FFD23F" stroke-width="4" stroke-linecap="round"><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>',
    near: '<circle cx="24" cy="24" r="10" fill="#FFD23F"/><g stroke="#FFD23F" stroke-width="3.5" stroke-linecap="round"><path d="M24 4v5M4 24h5M9.9 9.9l3.5 3.5M38.1 9.9l-3.5 3.5"/></g><path d="M20 52h28a10 10 0 0 0 0-20 14 14 0 0 0-27-2 11 11 0 0 0-1 22z" fill="#fff"/>',
    above:
      '<path d="M14 40h34a11 11 0 0 0 0-22 16 16 0 0 0-30-3 12.5 12.5 0 0 0-4 25z" fill="#cfd5e0"/><path d="M34 38l-8 12h7l-4 10 12-15h-7l5-7z" fill="#FFD23F"/>',
    unknown:
      '<path d="M14 46h34a11 11 0 0 0 0-22 16 16 0 0 0-30-3 12.5 12.5 0 0 0-4 25z" fill="#cfd5e0" opacity=".7"/>'
  };

  function blob(p: NearbyView) {
    const size = Math.round(28 + Math.min(1, Math.sqrt(p.pop) / 700) * 70);
    return `<span class="fc-blob fc-${p.fit}" style="--s:${size}px"><span>${p.city}${p.rent != null ? `<b>${money(p.rent)}</b>` : ''}</span></span>`;
  }

  function pickCity(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (CITY_NAMES.includes(value)) state.set({ city: value });
  }
</script>

<svelte:head>
  <title>{v ? v.name : 'City'} · Forecast preview</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;500;600&family=Barlow:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{#if v}
  <div class="wx sky-{v.fit}" class:nophoto={!v.image}>
    {#if v.image}
      <img
        class="photo"
        src={v.image.url}
        alt=""
        style="object-position:50% {v.image.focusY ?? 50}%"
      />
    {/if}

    <header class="top">
      <span class="mark">Rent Tool</span>
      <input
        class="search"
        list="fc-cities"
        value={state.city}
        onchange={pickCity}
        aria-label="City"
        spellcheck="false"
      />
      <datalist id="fc-cities">
        {#each CITY_NAMES as name (name)}<option value={name}></option>{/each}
      </datalist>
      <label class="pay">
        <span>Salary</span>
        <input
          inputmode="numeric"
          value={money(state.salary)}
          onchange={(e) => {
            const n = Number(e.currentTarget.value.replace(/[^0-9]/g, ''));
            if (n >= 10000) state.set({ salary: n });
          }}
        />
      </label>
      <div class="chips" role="radiogroup" aria-label="Home">
        {#each [['1br', '1 bed'], ['2br', '2 bed'], ['shared-2br', 'Shared']] as [key, label] (key)}
          <button
            role="radio"
            aria-checked={state.housing === key}
            onclick={() => state.set({ housing: key as HousingChoice })}>{label}</button
          >
        {/each}
      </div>
    </header>

    <section class="now" aria-label="Rent conditions in {v.city}">
      <p class="place">{v.city}, {v.state}</p>
      <div class="reading">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static icon markup -->
        <svg class="icon" viewBox="0 0 64 64" aria-hidden="true">{@html ICONS[v.fit]}</svg>
        <p class="temp">{money(v.rent)}</p>
      </div>
      <p class="cond">{CONDITION[v.fit]}</p>
      <p class="detail">
        {DETAIL[v.fit]}
        {#if v.margin != null}
          {v.margin >= 0 ? `${money(v.margin)} below` : `${money(-v.margin)} above`} your
          {money(v.ceiling)} limit for a {v.housingLabel.toLowerCase()}.
        {/if}
      </p>
      <p class="hilo">
        <span>1 bed <b>{money(v.r1)}</b></span>
        <span>2 bed <b>{money(v.r2)}</b></span>
        <span>Limit <b>{money(v.ceiling)}</b></span>
      </p>
      {#if v.image}
        <p class="credit">
          Photo: <a href={v.image.photographerUrl}>{v.image.photographerName}</a>
        </p>
      {/if}
    </section>

    <section class="panel strip" aria-labelledby="strip-h">
      <h2 id="strip-h">Next towns over</h2>
      <ol>
        {#each v.nearby as n (n.name)}
          <li>
            <svelte:element
              this={n.hasData ? 'button' : 'div'}
              class="day"
              onclick={n.hasData ? () => state.set({ city: n.name }) : undefined}
              role={n.hasData ? undefined : 'group'}
            >
              <span class="dname">{n.city}</span>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- static icon markup -->
              <svg viewBox="0 0 64 64" aria-label={CONDITION[n.fit]}>{@html ICONS[n.fit]}</svg>
              <b>{n.rent != null ? money(n.rent) : '—'}</b>
              <span class="dmeta">{n.miles} mi {n.bearing}</span>
            </svelte:element>
          </li>
        {/each}
      </ol>
    </section>

    <div class="lower">
      <section class="panel radar-panel" aria-labelledby="radar-h">
        <h2 id="radar-h">Rent radar</h2>
        <div class="radar">
          <PreviewMap
            view={v}
            tiles="dark"
            marker={blob}
            center={(c) => `<span class="fc-here"><i></i>${c.city}</span>`}
            onpick={(name) => state.set({ city: name })}
          />
        </div>
        <p class="legend">
          <span class="k within"></span>Under limit <span class="k near"></span>Close
          <span class="k above"></span>Over <span class="k unknown"></span>No data · size shows
          population
        </p>
      </section>

      <section class="panel details" aria-labelledby="det-h">
        <h2 id="det-h">Local conditions</h2>
        <dl>
          <div>
            <dt>Rent trend</dt>
            <dd>
              {v.yoy != null
                ? `${v.yoy < 0 ? 'Falling' : v.yoy > 0 ? 'Rising' : 'Steady'} ${Math.abs(v.yoy)}%`
                : '—'}
            </dd>
            <span>since last year</span>
          </div>
          <div>
            <dt>After rent</dt>
            <dd>{money(v.leftover)}</dd>
            <span>of {money(v.takeHome)} take-home</span>
          </div>
          {#if v.facts}
            <div>
              <dt>Commute</dt>
              <dd>
                {v.facts.commuteMinutes != null ? `${Math.round(v.facts.commuteMinutes)} min` : '—'}
              </dd>
              <span>average, one way</span>
            </div>
            <div>
              <dt>Vacancy</dt>
              <dd>{v.facts.rentalVacancy != null ? `${v.facts.rentalVacancy}%` : '—'}</dd>
              <span>of rentals empty</span>
            </div>
            <div>
              <dt>Renters</dt>
              <dd>{v.facts.renterShare != null ? `${Math.round(v.facts.renterShare)}%` : '—'}</dd>
              <span>of households</span>
            </div>
            <div>
              <dt>Household income</dt>
              <dd>{money(v.facts.householdIncome)}</dd>
              <span>{v.pop ? `${compact(v.pop)} people` : ''}</span>
            </div>
          {/if}
        </dl>

        <h2 class="out-h">Go see it</h2>
        <nav class="out" aria-label="Elsewhere">
          <a href={v.links.maps} target="_blank" rel="noopener">Google Maps</a>
          <a href={v.links.wikipedia} target="_blank" rel="noopener">Wikipedia</a>
          {#each v.links.search as link (link.provider)}
            <a href={link.url} target="_blank" rel="noopener" class="apt">{link.providerName}</a>
          {/each}
        </nav>
      </section>
    </div>

    <footer class="foot">
      Rent: Apartment List estimated medians, Sept 2026. Limit: 30% of gross pay. Census ACS
      2020–2024.
    </footer>
  </div>
{/if}

<PreviewBar {state} current="forecast" />

<style>
  .wx {
    --within: #3ddc84;
    --near: #ffd23f;
    --above: #ff5a5a;
    --unknown: #9aa3b5;
    --glass: rgb(255 255 255 / 0.13);
    --line: rgb(255 255 255 / 0.22);
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    padding: 0 clamp(16px, 4vw, 48px) 96px;
    color: #fff;
    font:
      500 16px/1.45 'Barlow',
      system-ui,
      sans-serif;
    background: #2b5fb4;
  }
  .wx.sky-within.nophoto {
    background: linear-gradient(180deg, #2c6ad1 0%, #5b9be8 45%, #9ccaf5 100%) fixed;
  }
  .wx.sky-near.nophoto {
    background: linear-gradient(180deg, #3c4f8f 0%, #c0776b 55%, #f2b27c 100%) fixed;
  }
  .wx.sky-above.nophoto {
    background: linear-gradient(180deg, #232a38 0%, #3d4659 50%, #5e6779 100%) fixed;
  }
  .wx.sky-unknown.nophoto {
    background: linear-gradient(180deg, #4a5466, #7d8697) fixed;
  }
  .photo {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
    filter: brightness(0.6) saturate(1.05);
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    padding: 18px 0;
  }
  .mark {
    font-weight: 700;
    margin-right: auto;
  }
  .search,
  .pay input {
    font: inherit;
    color: #fff;
    background: var(--glass);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 8px 16px;
  }
  .search {
    width: 19ch;
  }
  .pay {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .pay input {
    width: 11ch;
  }
  .chips {
    display: flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--glass);
    border: 1px solid var(--line);
  }
  .chips button {
    font: inherit;
    font-size: 14px;
    color: #fff;
    background: none;
    border: 0;
    border-radius: 999px;
    padding: 5px 12px;
    cursor: pointer;
  }
  .chips button[aria-checked='true'] {
    background: #fff;
    color: #1d2b4a;
    font-weight: 600;
  }
  input:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 2px;
  }

  .now {
    padding: clamp(24px, 6vh, 72px) 0 40px;
    text-align: center;
    text-shadow: 0 1px 12px rgb(0 0 0 / 0.25);
  }
  .place {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
  }
  .reading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .icon {
    width: clamp(80px, 10vw, 140px);
    filter: drop-shadow(0 4px 16px rgb(0 0 0 / 0.2));
  }
  .temp {
    margin: 0;
    font:
      300 clamp(96px, 15vw, 196px) / 1 'Barlow Condensed',
      sans-serif;
    letter-spacing: -0.03em;
  }
  .cond {
    margin: 0;
    font-size: 30px;
    font-weight: 600;
  }
  .detail {
    max-width: 34em;
    margin: 6px auto 0;
    font-size: 18px;
    opacity: 0.92;
  }
  .hilo {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin: 14px 0 0;
    font-size: 17px;
  }
  .hilo b {
    font-weight: 700;
  }
  .credit {
    margin: 20px 0 0;
    font-size: 12px;
    opacity: 0.7;
  }
  .credit a {
    color: inherit;
  }

  .panel {
    max-width: 76rem;
    margin: 0 auto 20px;
    padding: 16px 20px 18px;
    background: var(--glass);
    border: 1px solid var(--line);
    border-radius: 18px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .panel h2 {
    margin: 0 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
    font-weight: 600;
    opacity: 0.85;
  }
  .strip ol {
    display: flex;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-x: auto;
  }
  .strip li {
    flex: 1 0 104px;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    padding: 8px 4px;
    font: inherit;
    color: #fff;
    background: none;
    border: 0;
    border-radius: 12px;
    text-align: center;
  }
  button.day {
    cursor: pointer;
  }
  button.day:hover {
    background: rgb(255 255 255 / 0.12);
  }
  .day svg {
    width: 44px;
    height: 44px;
  }
  .dname {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.15;
    min-height: 2.3em;
    display: flex;
    align-items: center;
  }
  .day b {
    font:
      500 26px/1 'Barlow Condensed',
      sans-serif;
  }
  .dmeta {
    font-size: 12px;
    opacity: 0.75;
  }

  .lower {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 20px;
    max-width: 76rem;
    margin: 0 auto;
  }
  .lower .panel {
    margin: 0;
  }
  .radar {
    height: 440px;
    border-radius: 12px;
    overflow: hidden;
    background: #1b1d22;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 10px 0 0;
    font-size: 13px;
    opacity: 0.85;
  }
  .k {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-left: 6px;
  }
  .k.within {
    background: var(--within);
  }
  .k.near {
    background: var(--near);
  }
  .k.above {
    background: var(--above);
  }
  .k.unknown {
    background: var(--unknown);
  }
  .radar :global(.fc-blob) {
    --c: var(--unknown);
    position: relative;
    display: block;
    width: var(--s);
    height: var(--s);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--c) 80%, transparent) 0 28%,
      color-mix(in srgb, var(--c) 30%, transparent) 55%,
      transparent 72%
    );
    cursor: pointer;
  }
  .radar :global(.fc-blob span) {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #fff;
    font:
      600 11px/1.1 'Barlow',
      sans-serif;
    white-space: nowrap;
    text-shadow: 0 1px 3px #000;
  }
  .radar :global(.fc-blob b) {
    font:
      600 15px/1 'Barlow Condensed',
      sans-serif;
  }
  .radar :global(.fc-within) {
    --c: var(--within);
  }
  .radar :global(.fc-near) {
    --c: var(--near);
  }
  .radar :global(.fc-above) {
    --c: var(--above);
  }
  .radar :global(.fc-here) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transform: translate(-9px, -50%);
    color: #fff;
    font:
      700 15px 'Barlow',
      sans-serif;
    white-space: nowrap;
    text-shadow: 0 1px 3px #000;
  }
  .radar :global(.fc-here i) {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow:
      0 0 0 4px rgb(255 255 255 / 0.3),
      0 0 0 9px rgb(255 255 255 / 0.12);
  }

  .details dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 0;
  }
  .details dl div {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgb(255 255 255 / 0.08);
  }
  .details dt {
    font-size: 13px;
    opacity: 0.8;
  }
  .details dd {
    margin: 0;
    font:
      500 30px/1.1 'Barlow Condensed',
      sans-serif;
  }
  .details dl span {
    font-size: 12px;
    opacity: 0.75;
  }
  .out-h {
    margin-top: 20px !important;
  }
  .out {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .out a {
    padding: 7px 14px;
    border-radius: 999px;
    background: #fff;
    color: #1d2b4a;
    font-weight: 600;
    text-decoration: none;
  }
  .out a.apt {
    background: transparent;
    color: #fff;
    border: 1px solid var(--line);
  }
  .out a:hover {
    text-decoration: underline;
  }
  .foot {
    max-width: 76rem;
    margin: 28px auto 0;
    font-size: 12px;
    opacity: 0.75;
  }

  @media (max-width: 860px) {
    .lower {
      grid-template-columns: 1fr;
    }
    .mark {
      width: 100%;
    }
    .radar {
      height: 340px;
    }
  }
</style>
