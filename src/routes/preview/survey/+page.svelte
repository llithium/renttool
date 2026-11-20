<script lang="ts">
  import { createPreviewState } from '$lib/preview/state.svelte';
  import {
    CITY_NAMES,
    FIT_TEXT,
    cityHue,
    compact,
    signedMoney,
    type NearbyView
  } from '$lib/preview/model';
  import { STATE_NAME as STATE_NAMES } from '$lib/data/states';
  import { money } from '$lib/format';
  import PreviewMap from '$lib/preview/PreviewMap.svelte';
  import PreviewBar from '$lib/preview/PreviewBar.svelte';
  import type { HousingChoice } from '$lib/planning';

  const state = createPreviewState();
  let v = $derived(state.view);
  let hue = $derived(v ? cityHue(v.name) : 120);

  // Rent ruler geometry.
  const W = 360;
  let rated = $derived(v ? v.nearby.filter((n) => n.rent != null) : []);
  let scaleMax = $derived.by(() => {
    if (!v) return 2000;
    const vals = [v.ceiling, v.rent ?? 0, ...rated.map((n) => n.rent ?? 0)];
    return Math.ceil((Math.max(...vals) * 1.12) / 250) * 250;
  });
  let ticks = $derived.by(() => {
    const step = scaleMax > 4000 ? 1000 : scaleMax > 2000 ? 500 : 250;
    const out: number[] = [];
    for (let t = 0; t <= scaleMax; t += step) out.push(t);
    return out;
  });
  const x = (n: number) => (n / scaleMax) * W;
  // Stagger nearby labels into rows so they don't collide.
  let rows = $derived.by(() => {
    const sorted = [...rated].sort((a, b) => (a.rent ?? 0) - (b.rent ?? 0));
    const lastX: number[] = [];
    return sorted.map((n) => {
      const px = x(n.rent ?? 0);
      let row = 0;
      while (lastX[row] != null && px - lastX[row] < 64) row++;
      lastX[row] = px;
      return { n, px, row };
    });
  });
  let rowCount = $derived(Math.max(1, ...rows.map((r) => r.row + 1)));

  function pin(p: NearbyView) {
    if (p.rent == null) return `<span class="sv-town">${p.city}</span>`;
    return `<span class="sv-flag sv-${p.fit}"><b>${money(p.rent)}</b>${p.city}</span>`;
  }

  function pickCity(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (CITY_NAMES.includes(value)) state.set({ city: value });
  }

  const deg = (n: number, pos: string, neg: string) =>
    `${Math.abs(n).toFixed(2)}°${n >= 0 ? pos : neg}`;
</script>

<svelte:head>
  <title>{v ? v.name : 'City'} · Survey map preview</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="sheet">
  {#if v}
    <div class="map">
      <PreviewMap
        view={v}
        tiles="light"
        marker={pin}
        center={(c) =>
          `<span class="sv-bench"><svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 1 23 21H1z"/><circle cx="12" cy="14" r="2.6"/></svg>${c.city}</span>`}
        onpick={(name) => state.set({ city: name })}
        label="Map of {v.city} and nearby towns, labelled with rent"
      />
    </div>

    <aside class="block" aria-label="{v.city} rent survey">
      <header class="title">
        <span class="mark">Rent Tool</span>
        <label class="pick">
          <span class="sr">City</span>
          <input list="sv-cities" value={state.city} onchange={pickCity} spellcheck="false" />
        </label>
        <datalist id="sv-cities">
          {#each CITY_NAMES as name (name)}<option value={name}></option>{/each}
        </datalist>
        <h1>{v.city}</h1>
        <p class="sub">
          {STATE_NAMES[v.state] ?? v.state}
          <span class="coord">{deg(v.lat, 'N', 'S')} {deg(v.lng, 'E', 'W')}</span>
        </p>
      </header>

      <figure class="plate" style="--hue:{hue}">
        {#if v.image}
          <img
            src={v.image.url}
            alt={v.image.alt}
            style="object-position:50% {v.image.focusY ?? 50}%"
          />
          <figcaption>
            Photo: <a href={v.image.photographerUrl}>{v.image.photographerName}</a> /
            {v.image.source === 'unsplash' ? 'Unsplash' : 'Wikimedia Commons'}
          </figcaption>
        {:else}
          <div class="noplate" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" />
              <circle cx="50" cy="50" r="28" />
              <path d="M50 4 54 50 50 96 46 50z" />
              <path d="M4 50 50 46 96 50 50 54z" class="minor" />
            </svg>
            <div>
              <b>{deg(v.lat, 'N', 'S')}</b>
              <b>{deg(v.lng, 'E', 'W')}</b>
              <span>{v.pop ? `${compact(v.pop)} people` : ''}</span>
            </div>
          </div>
        {/if}
      </figure>

      <section class="ruler" aria-labelledby="ruler-h">
        <h2 id="ruler-h" class="verdict sv-{v.fit}">
          {FIT_TEXT[v.fit]}
          {#if v.margin != null}
            <span
              >{v.margin >= 0 ? `${money(v.margin)} under` : `${money(-v.margin)} over`} your limit</span
            >
          {/if}
        </h2>
        <svg
          viewBox="-12 {-22 - rowCount * 18} {W + 24} {rowCount * 18 + 70}"
          role="img"
          aria-label="Rent scale: {v.city} {money(v.rent)}, your limit {money(v.ceiling)}"
        >
          <defs>
            <pattern
              id="hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" />
            </pattern>
          </defs>
          {#each rows as r (r.n.name)}
            <g class="near sv-{r.n.fit}">
              <line x1={r.px} x2={r.px} y1={-6} y2={-14 - r.row * 18} />
              <text x={r.px} y={-17 - r.row * 18} text-anchor="middle">{r.n.city}</text>
            </g>
          {/each}
          <rect class="ground" x="0" y="0" width={x(v.ceiling)} height="12" />
          <rect class="bar" x="0" y="0" width={W} height="12" />
          {#each ticks as t (t)}
            <line class="tick" x1={x(t)} x2={x(t)} y1="12" y2="17" />
            <text class="tlabel" x={x(t)} y="28" text-anchor="middle"
              >{t >= 1000 ? `${t / 1000}k` : t}</text
            >
          {/each}
          <line class="limit" x1={x(v.ceiling)} x2={x(v.ceiling)} y1="-4" y2="40" />
          <text
            class="llabel"
            x={x(v.ceiling)}
            y="40"
            dx={x(v.ceiling) > W * 0.7 ? -4 : 4}
            text-anchor={x(v.ceiling) > W * 0.7 ? 'end' : 'start'}
            >your limit {money(v.ceiling)}</text
          >
          {#if v.rent != null}
            <path class="here sv-{v.fit}" d="M{x(v.rent)} 6 l-7 -14 h14z" />
          {/if}
        </svg>
        <p class="legend">
          <span class="key here-key"></span>{v.city}, {money(v.rent)} for {v.housingLabel.toLowerCase()}
          <span class="key ground-key"></span>What you can cover
        </p>
      </section>

      <section class="inputs">
        <label>
          <span>Annual pay</span>
          <input
            inputmode="numeric"
            value={money(state.salary)}
            onchange={(e) => {
              const n = Number(e.currentTarget.value.replace(/[^0-9]/g, ''));
              if (n >= 10000) state.set({ salary: n });
            }}
          />
        </label>
        <label>
          <span>Home</span>
          <select
            value={state.housing}
            onchange={(e) => state.set({ housing: e.currentTarget.value as HousingChoice })}
          >
            <option value="1br">1 bedroom</option>
            <option value="2br">2 bedrooms</option>
            <option value="shared-2br">Shared 2 bedroom</option>
          </select>
        </label>
        <p class="calc">
          {money(v.takeHome)} take-home a month leaves <b>{money(v.leftover)}</b> after rent.
        </p>
      </section>

      <section class="key-facts" aria-label="Local context">
        <dl>
          {#if v.facts}
            <div>
              <dt>Household income</dt>
              <dd>{money(v.facts.householdIncome)}</dd>
            </div>
            <div>
              <dt>Average commute</dt>
              <dd>
                {v.facts.commuteMinutes != null ? `${Math.round(v.facts.commuteMinutes)} min` : '—'}
              </dd>
            </div>
            <div>
              <dt>Households renting</dt>
              <dd>{v.facts.renterShare != null ? `${Math.round(v.facts.renterShare)}%` : '—'}</dd>
            </div>
            <div>
              <dt>Rentals vacant</dt>
              <dd>{v.facts.rentalVacancy != null ? `${v.facts.rentalVacancy}%` : '—'}</dd>
            </div>
          {/if}
          <div>
            <dt>Rent since last year</dt>
            <dd>{v.yoy != null ? `${v.yoy > 0 ? '+' : ''}${v.yoy}%` : '—'}</dd>
          </div>
          <div>
            <dt>2 bedroom</dt>
            <dd>{money(v.r2)}</dd>
          </div>
        </dl>
      </section>

      <section class="towns" aria-labelledby="towns-h">
        <h2 id="towns-h">Within 30 miles</h2>
        <table>
          <tbody>
            {#each v.nearby as n (n.name)}
              <tr>
                <th scope="row">
                  {#if n.hasData}
                    <button onclick={() => state.set({ city: n.name })}>{n.city}</button>
                  {:else}
                    {n.city}
                  {/if}
                </th>
                <td class="dist">{n.miles} mi {n.bearing}</td>
                <td class="rent sv-{n.fit}">{n.rent != null ? money(n.rent) : 'no data'}</td>
                <td class="delta">{n.delta != null ? signedMoney(n.delta) : ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <nav class="refs" aria-label="Elsewhere">
        <h2>Elsewhere</h2>
        <a href={v.links.maps} target="_blank" rel="noopener">Google Maps</a>
        <a href={v.links.wikipedia} target="_blank" rel="noopener">Wikipedia</a>
        {#each v.links.search as link (link.provider)}
          <a href={link.url} target="_blank" rel="noopener"
            >{link.providerName}{link.capDescription ? ` ${link.capDescription}` : ''}</a
          >
        {/each}
      </nav>
      <p class="src">
        Apartment List median rents, Sept 2026. Census ACS 2020–2024. Limit is 30% of gross pay.
      </p>
    </aside>
  {:else}
    <p class="missing">That city isn't in the bundled list yet.</p>
  {/if}
</div>

<PreviewBar {state} current="survey" />

<style>
  .sheet {
    --paper: #eef0e8;
    --ink: #1d2b26;
    --muted: #5d6a63;
    --rule: #c9cdbf;
    --within: #2e6b4e;
    --near: #b7832a;
    --above: #a43f2e;
    position: relative;
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink);
    font:
      400 15px/1.5 'Archivo',
      system-ui,
      sans-serif;
    font-stretch: 100%;
  }
  .map {
    position: fixed;
    inset: 0 0 0 440px;
    background: #e4e6de;
  }
  .block {
    position: relative;
    width: 440px;
    min-height: 100vh;
    padding: 24px 28px 96px;
    background: var(--paper);
    border-right: 1.5px solid var(--ink);
    box-sizing: border-box;
  }
  .title {
    border: 1.5px solid var(--ink);
    padding: 14px 16px 12px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
  }
  .mark {
    font-weight: 700;
    font-stretch: 62%;
    font-size: 15px;
    letter-spacing: 0.02em;
  }
  .pick input {
    width: 13ch;
    font: inherit;
    font-size: 13px;
    border: 0;
    border-bottom: 1px solid var(--muted);
    background: transparent;
    color: var(--ink);
    text-align: right;
  }
  h1 {
    grid-column: 1 / -1;
    margin: 8px 0 0;
    font-size: clamp(34px, 3.4vw, 46px);
    line-height: 0.95;
    font-weight: 850;
    font-stretch: 125%;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .sub {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .coord {
    font-variant-numeric: tabular-nums;
  }
  .plate {
    margin: 0;
    border: 1.5px solid var(--ink);
    border-top: 0;
  }
  .plate img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    filter: saturate(0.9);
  }
  .plate figcaption {
    padding: 4px 16px;
    font-size: 11px;
    color: var(--muted);
    border-top: 1px solid var(--rule);
  }
  .plate figcaption a {
    color: inherit;
  }
  .noplate {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 16px;
    align-items: center;
    aspect-ratio: 3 / 1.4;
    padding: 16px;
    background: hsl(var(--hue) 22% 86%);
  }
  .noplate svg {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1;
  }
  .noplate path {
    fill: var(--ink);
    stroke: none;
  }
  .noplate path.minor {
    fill: var(--muted);
  }
  .noplate b {
    display: block;
    font-size: 30px;
    line-height: 1.05;
    font-weight: 800;
    font-stretch: 112%;
    font-variant-numeric: tabular-nums;
  }
  .noplate span {
    display: block;
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
  }

  .ruler {
    padding: 20px 0 8px;
    border-bottom: 1.5px solid var(--ink);
  }
  .verdict {
    margin: 0 0 8px;
    font-size: 26px;
    line-height: 1.1;
    font-weight: 800;
    font-stretch: 112%;
  }
  .verdict span {
    display: block;
    margin-top: 4px;
    font-size: 15px;
    font-weight: 500;
    font-stretch: 100%;
    color: var(--muted);
  }
  .verdict.sv-within {
    color: var(--within);
  }
  .verdict.sv-near {
    color: var(--near);
  }
  .verdict.sv-above {
    color: var(--above);
  }
  .ruler svg {
    display: block;
    width: 100%;
    overflow: visible;
  }
  .ruler .bar {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.2;
  }
  .ruler pattern line {
    stroke: var(--within);
    stroke-width: 2.4;
  }
  .ruler .ground {
    fill: url(#hatch);
  }
  .tick {
    stroke: var(--ink);
  }
  .tlabel {
    font-size: 9.5px;
    fill: var(--muted);
  }
  .limit {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-dasharray: 3 2;
  }
  .llabel {
    font-size: 10.5px;
    font-weight: 700;
    fill: var(--ink);
  }
  .here {
    fill: var(--muted);
    stroke: var(--paper);
    stroke-width: 1.5;
  }
  .here.sv-within {
    fill: var(--within);
  }
  .here.sv-near {
    fill: var(--near);
  }
  .here.sv-above {
    fill: var(--above);
  }
  .near line {
    stroke: var(--muted);
  }
  .near text {
    font-size: 9.5px;
    fill: var(--muted);
    font-stretch: 80%;
  }
  .near.sv-above text {
    fill: var(--above);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 4px 0 8px;
    font-size: 12px;
    color: var(--muted);
  }
  .key {
    display: inline-block;
    width: 12px;
    height: 10px;
  }
  .here-key {
    background: var(--ink);
    clip-path: polygon(50% 100%, 0 0, 100% 0);
  }
  .ground-key {
    margin-left: 8px;
    background: repeating-linear-gradient(45deg, var(--within) 0 1.5px, transparent 1.5px 4px);
    border: 1px solid var(--ink);
  }

  .inputs {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 0 16px;
    padding: 14px 0;
    border-bottom: 1.5px solid var(--ink);
  }
  .inputs label span {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  .inputs input,
  .inputs select {
    width: 100%;
    font: inherit;
    font-size: 20px;
    font-weight: 700;
    font-stretch: 112%;
    color: var(--ink);
    border: 0;
    border-bottom: 1.5px solid var(--ink);
    background: transparent;
    padding: 2px 0;
  }
  .calc {
    grid-column: 1 / -1;
    margin: 10px 0 0;
    font-size: 14px;
  }
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--within);
    outline-offset: 2px;
  }

  .key-facts dl {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    margin: 0;
    border-bottom: 1.5px solid var(--ink);
  }
  .key-facts div {
    padding: 12px 8px 12px 0;
    border-bottom: 1px solid var(--rule);
  }
  .key-facts dt {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.25;
  }
  .key-facts dd {
    margin: 2px 0 0;
    font-size: 19px;
    font-weight: 700;
    font-stretch: 112%;
    font-variant-numeric: tabular-nums;
  }

  .towns h2,
  .refs h2 {
    margin: 20px 0 6px;
    font-size: 13px;
    font-weight: 700;
    font-stretch: 125%;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  tr {
    border-bottom: 1px solid var(--rule);
  }
  th,
  td {
    padding: 6px 0;
    text-align: left;
    font-weight: 400;
  }
  th button {
    font: inherit;
    font-weight: 600;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }
  th button:hover {
    text-decoration-color: var(--ink);
  }
  .dist {
    color: var(--muted);
    font-size: 13px;
  }
  .rent {
    text-align: right;
    font-weight: 700;
  }
  .rent.sv-unknown {
    font-weight: 400;
    color: var(--muted);
    font-size: 12px;
  }
  .rent.sv-above {
    color: var(--above);
  }
  .delta {
    text-align: right;
    width: 64px;
    color: var(--muted);
    font-size: 13px;
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .refs h2 {
    width: 100%;
  }
  .refs a {
    color: var(--ink);
    font-weight: 600;
    text-underline-offset: 3px;
  }
  .src {
    margin-top: 20px;
    font-size: 11px;
    color: var(--muted);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* Map symbols. */
  .map :global(.sv-flag) {
    --c: var(--muted);
    display: inline-flex;
    flex-direction: column;
    transform: translate(-1px, -100%);
    padding: 3px 7px 3px 6px;
    border-left: 2px solid var(--c);
    background: rgb(238 240 232 / 0.94);
    color: var(--ink);
    font:
      400 11px/1.15 'Archivo',
      sans-serif;
    font-stretch: 85%;
    white-space: nowrap;
    cursor: pointer;
  }
  .map :global(.sv-flag b) {
    color: var(--c);
    font-size: 14px;
    font-weight: 800;
    font-stretch: 110%;
  }
  .map :global(.sv-flag::after) {
    content: '';
    position: absolute;
    left: -5px;
    bottom: -5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
    border: 1.5px solid var(--paper);
  }
  .map :global(.sv-within) {
    --c: var(--within);
  }
  .map :global(.sv-near) {
    --c: var(--near);
  }
  .map :global(.sv-above) {
    --c: var(--above);
  }
  .map :global(.sv-town) {
    display: inline-block;
    transform: translate(-4px, -50%);
    padding-left: 11px;
    font:
      400 11px 'Archivo',
      sans-serif;
    color: var(--muted);
    white-space: nowrap;
    background: radial-gradient(
        circle 3.5px at 4px 50%,
        transparent 55%,
        var(--muted) 60% 95%,
        transparent
      )
      no-repeat;
  }
  .map :global(.sv-bench) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transform: translate(-12px, -50%);
    font:
      800 15px 'Archivo',
      sans-serif;
    font-stretch: 125%;
    text-transform: uppercase;
    color: var(--ink);
    text-shadow:
      0 0 3px var(--paper),
      0 0 3px var(--paper);
    white-space: nowrap;
  }
  .map :global(.sv-bench svg) {
    width: 24px;
    fill: var(--ink);
  }
  .map :global(.sv-bench circle) {
    fill: var(--paper);
  }
  .missing {
    padding: 4rem;
  }

  @media (max-width: 860px) {
    .map {
      position: relative;
      inset: auto;
      height: 52vh;
    }
    .block {
      width: auto;
      border-right: 0;
      padding: 20px 16px 96px;
    }
  }
</style>
