<script lang="ts">
  import { createPreviewState } from '$lib/preview/state.svelte';
  import { CITY_NAMES, cityHue, signedMoney, type NearbyView } from '$lib/preview/model';
  import { money } from '$lib/format';
  import PreviewMap from '$lib/preview/PreviewMap.svelte';
  import PreviewBar from '$lib/preview/PreviewBar.svelte';
  import type { HousingChoice } from '$lib/planning';

  const state = createPreviewState();
  let v = $derived(state.view);
  let hue = $derived(v ? cityHue(v.name) : 30);
  const ANGLE: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315
  };
  let exits = $derived(v ? [...v.nearby].sort((a, b) => a.miles - b.miles) : []);

  function sign(p: NearbyView) {
    return p.rent != null
      ? `<span class="hw-pin hw-${p.fit}">${p.city}<b>${money(p.rent)}</b></span>`
      : `<span class="hw-pin hw-none">${p.city}</span>`;
  }

  function pickCity(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (CITY_NAMES.includes(value)) state.set({ city: value });
  }
</script>

<svelte:head>
  <title>{v ? v.name : 'City'} · Highway signs preview</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Overpass:ital,wght@0,400..900;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="road" style="--hue:{hue}">
  {#if v}
    <section class="scene" class:nophoto={!v.image}>
      {#if v.image}
        <img
          class="scenery"
          src={v.image.url}
          alt={v.image.alt}
          style="object-position:50% {v.image.focusY ?? 50}%"
        />
      {:else}
        <svg
          class="scenery"
          viewBox="0 0 1600 700"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="hsl({hue} 45% 22%)" />
              <stop offset="0.75" stop-color="hsl({(hue + 30) % 360} 55% 62%)" />
            </linearGradient>
          </defs>
          <rect width="1600" height="700" fill="url(#sky)" />
          <path d="M0 520 Q400 470 800 500 T1600 490 V700 H0z" fill="hsl({hue} 25% 18%)" />
          <path d="M640 700 L790 500 L810 500 L960 700z" fill="#2c2f33" />
          <path d="M800 505 V700" stroke="#f2c230" stroke-width="5" stroke-dasharray="26 22" />
        </svg>
      {/if}

      <header class="top">
        <span class="mark">Rent Tool</span>
        <span class="credit">
          {#if v.image}Photo: <a href={v.image.photographerUrl}>{v.image.photographerName}</a>{/if}
        </span>
      </header>

      <div class="gantry">
        <div class="guide" role="group" aria-label="{v.city} rent">
          <div class="guide-top">
            <span class="shield" aria-hidden="true">{v.state}</span>
            <h1>{v.city}</h1>
          </div>
          <p class="guide-rent">
            <span>{v.housingLabel}</span>
            <b>{money(v.rent)}</b><small>/mo</small>
          </p>
        </div>

        <div class="limit" aria-label="Your rent limit {money(v.ceiling)} a month">
          <span>Rent<br />limit</span>
          <b>{Math.round(v.ceiling).toLocaleString('en-US')}</b>
        </div>

        {#if v.fit === 'above' || v.fit === 'near'}
          <div class="warn" class:near={v.fit === 'near'}>
            <div>
              {#if v.fit === 'above'}
                <span>Over by</span><b>{money(-(v.margin ?? 0))}</b>
              {:else}
                <span>Tight</span><b>{money(v.margin)}</b><span>to spare</span>
              {/if}
            </div>
          </div>
        {:else if v.margin != null}
          <div class="spare">
            <span>To spare</span><b>{money(v.margin)}</b>
          </div>
        {/if}
      </div>
      <div class="posts" aria-hidden="true"><i></i><i></i></div>
    </section>

    <section class="planner" aria-label="Your trip">
      <label>
        <span>Heading to</span>
        <input list="hw-cities" value={state.city} onchange={pickCity} spellcheck="false" />
      </label>
      <datalist id="hw-cities">
        {#each CITY_NAMES as name (name)}<option value={name}></option>{/each}
      </datalist>
      <label>
        <span>Earning</span>
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
        <span>Looking for</span>
        <select
          value={state.housing}
          onchange={(e) => state.set({ housing: e.currentTarget.value as HousingChoice })}
        >
          <option value="1br">1 bedroom</option>
          <option value="2br">2 bedrooms</option>
          <option value="shared-2br">Shared 2 bedroom</option>
        </select>
      </label>
      <p class="trip">
        Your limit is 30% of pay. After rent you keep about <b>{money(v.leftover)}</b> of
        {money(v.takeHome)} take-home each month.
      </p>
    </section>

    <section class="facts" aria-label="About {v.city}">
      <div class="citylimit">
        <b>{v.city}</b>
        <span>City limit</span>
        <span>Pop {v.pop ? v.pop.toLocaleString('en-US') : 'unknown'}</span>
      </div>
      {#if v.facts}
        <div class="info"><span>Household income</span><b>{money(v.facts.householdIncome)}</b></div>
        <div class="info">
          <span>Avg commute</span><b
            >{v.facts.commuteMinutes != null ? `${Math.round(v.facts.commuteMinutes)} min` : '—'}</b
          >
        </div>
        <div class="info">
          <span>Renters</span><b
            >{v.facts.renterShare != null ? `${Math.round(v.facts.renterShare)}%` : '—'}</b
          >
        </div>
        <div class="info">
          <span>Vacant rentals</span><b
            >{v.facts.rentalVacancy != null ? `${v.facts.rentalVacancy}%` : '—'}</b
          >
        </div>
      {/if}
      <div class="info">
        <span>Rent vs last year</span><b
          >{v.yoy != null ? `${v.yoy > 0 ? '+' : ''}${v.yoy}%` : '—'}</b
        >
      </div>
    </section>

    <section class="exits">
      <h2>Nearby exits</h2>
      <p class="hint">Exit numbers are miles from {v.city}. Rent is for the same home.</p>
      <ul>
        {#each exits as n (n.name)}
          <li>
            <svelte:element
              this={n.hasData ? 'button' : 'div'}
              class="exit hw-{n.fit}"
              onclick={n.hasData ? () => state.set({ city: n.name }) : undefined}
              role={n.hasData ? undefined : 'group'}
            >
              <span class="tab">Exit {n.miles}</span>
              <span class="ename">{n.city}</span>
              <span class="erow">
                <svg
                  class="arrow"
                  viewBox="0 0 20 20"
                  style="transform:rotate({ANGLE[n.bearing]}deg)"
                  aria-label={n.bearing}
                >
                  <path d="M10 2 17 10h-4.5v8h-5v-8H3z" />
                </svg>
                {#if n.rent != null}
                  <b>{money(n.rent)}</b>
                  <span class="delta">{n.delta != null ? signedMoney(n.delta) : ''}</span>
                {:else}
                  <span class="delta">No rent data</span>
                {/if}
              </span>
              {#if n.fit === 'above'}<span class="plaque">Over limit</span>{/if}
            </svelte:element>
          </li>
        {/each}
      </ul>
    </section>

    <section class="atlas-wrap">
      <div class="atlas">
        <PreviewMap
          view={v}
          tiles="voyager"
          marker={sign}
          center={(c) => `<span class="hw-here">${c.city}</span>`}
          onpick={(name) => state.set({ city: name })}
        />
      </div>
      <div class="services">
        <div class="svc lodging">
          <h2>Lodging</h2>
          {#each v.links.search as link (link.provider)}
            <a href={link.url} target="_blank" rel="noopener">
              {link.providerName}<small>{link.capDescription ?? 'all listings'}</small>
            </a>
          {/each}
        </div>
        <div class="svc poi">
          <h2>Points of interest</h2>
          <a href={v.links.wikipedia} target="_blank" rel="noopener"
            >Wikipedia<small>History and neighborhoods</small></a
          >
          <a href={v.links.maps} target="_blank" rel="noopener"
            >Google Maps<small>Street View and directions</small></a
          >
        </div>
      </div>
    </section>

    <footer class="foot">
      Apartment List estimated median rent, Sept 2026. Census ACS 2020–2024. Distances are
      straight-line.
    </footer>
  {/if}
</div>

<PreviewBar {state} current="highway" />

<style>
  .road {
    --asphalt: #2c2f33;
    --green: #00704a;
    --blue: #1e4fa0;
    --brown: #6b3e26;
    --yellow: #f2c230;
    --white: #f7f7f2;
    min-height: 100vh;
    padding-bottom: 96px;
    background: var(--asphalt);
    color: var(--white);
    font:
      500 16px/1.45 'Overpass',
      system-ui,
      sans-serif;
  }
  .scene {
    position: relative;
    min-height: min(78vh, 680px);
    overflow: hidden;
    padding: 0 clamp(16px, 4vw, 56px);
    isolation: isolate;
  }
  .scenery {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
  .scene:not(.nophoto)::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(rgb(0 0 0 / 0.35), transparent 40%, rgb(44 47 51 / 0.9));
  }
  .top {
    display: flex;
    justify-content: space-between;
    padding: 18px 0;
    font-size: 12px;
  }
  .mark {
    font-weight: 900;
    font-size: 18px;
  }
  .credit a {
    color: inherit;
  }
  .gantry {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 18px;
    margin-top: clamp(16px, 6vh, 64px);
  }
  .guide {
    min-width: min(100%, 520px);
    padding: 18px 28px 20px;
    background: var(--green);
    border-radius: 14px;
    box-shadow:
      inset 0 0 0 4px var(--green),
      inset 0 0 0 7px var(--white),
      0 10px 30px rgb(0 0 0 / 0.35);
  }
  .guide-top {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .shield {
    display: grid;
    place-items: center;
    flex: none;
    width: 58px;
    height: 62px;
    background: var(--white);
    color: var(--asphalt);
    font-weight: 900;
    font-size: 20px;
    clip-path: path('M29 0 C40 6 50 6 58 3 C60 30 52 50 29 62 C6 50 -2 30 0 3 C8 6 18 6 29 0Z');
  }
  h1 {
    margin: 0;
    font-size: clamp(44px, 6.5vw, 92px);
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.005em;
    padding-top: 0.12em;
  }
  .guide-rent {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 3px solid var(--white);
  }
  .guide-rent span {
    font-size: 22px;
  }
  .guide-rent b {
    margin-left: auto;
    font-size: clamp(36px, 4.4vw, 60px);
    font-weight: 800;
    line-height: 1;
  }
  .guide-rent small {
    font-size: 20px;
  }
  .limit {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 150px;
    padding: 14px 10px 12px;
    background: var(--white);
    color: #111;
    border-radius: 8px;
    box-shadow:
      inset 0 0 0 3px var(--white),
      inset 0 0 0 6px #111,
      0 10px 30px rgb(0 0 0 / 0.35);
    text-align: center;
  }
  .limit span {
    font-size: 21px;
    font-weight: 800;
    line-height: 1.05;
    text-transform: uppercase;
  }
  .limit b {
    font-size: 50px;
    font-weight: 800;
    line-height: 1;
    margin-top: 6px;
    letter-spacing: -0.02em;
  }
  .warn {
    display: grid;
    place-items: center;
    width: 150px;
    height: 150px;
    margin: 12px;
    background: var(--yellow);
    color: #111;
    border-radius: 10px;
    transform: rotate(45deg);
    box-shadow:
      inset 0 0 0 4px var(--yellow),
      inset 0 0 0 7px #111,
      0 10px 30px rgb(0 0 0 / 0.35);
  }
  .warn div {
    transform: rotate(-45deg);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    line-height: 1.05;
  }
  .warn span {
    font-weight: 800;
    font-size: 16px;
    text-transform: uppercase;
  }
  .warn b {
    font-size: 30px;
    font-weight: 900;
  }
  .spare {
    display: flex;
    flex-direction: column;
    padding: 14px 18px;
    background: var(--green);
    border-radius: 10px;
    box-shadow:
      inset 0 0 0 3px var(--green),
      inset 0 0 0 5px var(--white),
      0 10px 30px rgb(0 0 0 / 0.35);
  }
  .spare span {
    font-size: 18px;
  }
  .spare b {
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
  }
  .posts {
    display: flex;
    justify-content: space-between;
    width: min(100%, 520px);
    padding: 0 60px;
    box-sizing: border-box;
    height: 200px;
    margin-bottom: -40px;
  }
  .posts i {
    width: 12px;
    background: linear-gradient(90deg, #8c939b, #c7ccd1 50%, #7a8188);
  }

  .planner {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 0 20px;
    margin: 0 clamp(16px, 4vw, 56px);
    padding: 18px 0 20px;
    border-top: 6px dashed var(--yellow);
  }
  .planner span {
    display: block;
    font-size: 13px;
    color: #c5c8cc;
  }
  .planner input,
  .planner select {
    width: 100%;
    font: inherit;
    font-size: 26px;
    font-weight: 800;
    color: var(--white);
    background: transparent;
    border: 0;
    border-bottom: 2px solid #6b7077;
    padding: 2px 0;
  }
  .planner option {
    color: #111;
  }
  .trip {
    grid-column: 1 / -1;
    margin: 14px 0 0;
    color: #d7dade;
  }
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--yellow);
    outline-offset: 3px;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 36px clamp(16px, 4vw, 56px) 0;
    align-items: stretch;
  }
  .citylimit {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 22px;
    background: var(--green);
    border-radius: 8px;
    box-shadow:
      inset 0 0 0 3px var(--green),
      inset 0 0 0 5px var(--white);
    text-align: center;
    line-height: 1.15;
  }
  .citylimit b {
    font-size: 24px;
  }
  .citylimit span {
    font-size: 15px;
  }
  .info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 10px 16px;
    background: var(--white);
    color: #111;
    border-radius: 6px;
    box-shadow:
      inset 0 0 0 2px var(--white),
      inset 0 0 0 4px #111;
  }
  .info span {
    font-size: 13px;
  }
  .info b {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
  }

  h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
  }
  .hint {
    margin: 2px 0 18px;
    color: #b8bcc1;
    font-size: 14px;
  }
  .exits {
    margin: 64px clamp(16px, 4vw, 56px) 0;
  }
  .exits ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 34px 16px;
    list-style: none;
    margin: 0;
    padding: 14px 0 0;
  }
  .exit {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 12px 16px 14px;
    background: var(--green);
    color: var(--white);
    border: 0;
    border-radius: 10px;
    box-shadow:
      inset 0 0 0 3px var(--green),
      inset 0 0 0 5px var(--white);
    font: inherit;
    text-align: left;
    box-sizing: border-box;
  }
  button.exit {
    cursor: pointer;
  }
  button.exit:hover {
    filter: brightness(1.12);
  }
  .exit.hw-unknown {
    background: #3d4247;
    box-shadow:
      inset 0 0 0 3px #3d4247,
      inset 0 0 0 5px #8c939b;
    color: #d7dade;
  }
  .tab {
    position: absolute;
    top: -22px;
    right: 14px;
    padding: 2px 10px 0;
    background: inherit;
    border-radius: 6px 6px 0 0;
    box-shadow:
      inset 0 3px 0 -1px transparent,
      inset 2px 2px 0 0 var(--white),
      inset -2px 0 0 0 var(--white);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .hw-unknown .tab {
    box-shadow:
      inset 2px 2px 0 0 #8c939b,
      inset -2px 0 0 0 #8c939b;
  }
  .ename {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.1;
    padding-top: 4px;
  }
  .erow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .arrow {
    width: 22px;
    height: 22px;
    fill: currentColor;
    flex: none;
  }
  .erow b {
    font-size: 24px;
    font-weight: 800;
  }
  .delta {
    font-size: 14px;
    opacity: 0.85;
  }
  .plaque {
    align-self: flex-start;
    margin-top: 10px;
    padding: 2px 8px 0;
    background: var(--yellow);
    color: #111;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .atlas-wrap {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 20px;
    margin: 64px clamp(16px, 4vw, 56px) 0;
  }
  .atlas {
    min-height: 460px;
    border-radius: 10px;
    overflow: hidden;
    background: #e6e3dc;
  }
  .services {
    display: grid;
    gap: 20px;
    align-content: start;
  }
  .svc {
    padding: 16px 20px 18px;
    border-radius: 10px;
  }
  .svc h2 {
    font-size: 22px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .lodging {
    background: var(--blue);
    box-shadow:
      inset 0 0 0 3px var(--blue),
      inset 0 0 0 5px var(--white);
  }
  .poi {
    background: var(--brown);
    box-shadow:
      inset 0 0 0 3px var(--brown),
      inset 0 0 0 5px var(--white);
  }
  .svc a {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 7px 12px 5px;
    margin-top: 6px;
    background: var(--white);
    color: #111;
    border-radius: 4px;
    font-weight: 800;
    font-size: 17px;
    text-decoration: none;
  }
  .svc a small {
    font-weight: 500;
    font-size: 13px;
    color: #555;
  }
  .svc a:hover {
    text-decoration: underline;
  }
  .atlas :global(.hw-pin) {
    display: inline-flex;
    gap: 6px;
    transform: translate(-50%, -50%);
    padding: 3px 8px 1px;
    background: var(--green);
    color: #fff;
    border-radius: 5px;
    box-shadow:
      inset 0 0 0 1px var(--green),
      inset 0 0 0 2.5px #fff;
    font:
      600 12px/1.3 'Overpass',
      sans-serif;
    white-space: nowrap;
    cursor: pointer;
  }
  .atlas :global(.hw-pin.hw-above) {
    background: var(--yellow);
    color: #111;
    box-shadow:
      inset 0 0 0 1px var(--yellow),
      inset 0 0 0 2.5px #111;
  }
  .atlas :global(.hw-pin.hw-none) {
    background: #fff;
    color: #555;
    box-shadow: inset 0 0 0 1.5px #999;
    cursor: default;
  }
  .atlas :global(.hw-here) {
    display: inline-block;
    transform: translate(-50%, -50%);
    padding: 6px 12px 3px;
    background: var(--asphalt);
    color: #fff;
    border-radius: 6px;
    border: 2px solid var(--yellow);
    font:
      800 15px/1.2 'Overpass',
      sans-serif;
    white-space: nowrap;
  }
  .foot {
    margin: 40px clamp(16px, 4vw, 56px) 0;
    font-size: 12px;
    color: #9aa0a6;
  }

  @media (max-width: 820px) {
    .planner,
    .atlas-wrap {
      grid-template-columns: 1fr;
    }
    .planner label {
      margin-top: 10px;
    }
    .posts {
      height: 40px;
    }
    .warn {
      width: 120px;
      height: 120px;
    }
    .atlas {
      min-height: 340px;
    }
  }
</style>
