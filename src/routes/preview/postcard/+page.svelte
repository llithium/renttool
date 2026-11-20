<script lang="ts">
  import { createPreviewState } from '$lib/preview/state.svelte';
  import { CITY_NAMES, FIT_TEXT, cityHue, compact, type NearbyView } from '$lib/preview/model';
  import { money } from '$lib/format';
  import PreviewMap from '$lib/preview/PreviewMap.svelte';
  import PreviewBar from '$lib/preview/PreviewBar.svelte';
  import type { HousingChoice } from '$lib/planning';

  const state = createPreviewState();
  let v = $derived(state.view);
  let hue = $derived(v ? cityHue(v.name) : 200);
  let letterSize = $derived(
    v ? `min(19cqi, ${(100 / Math.max(v.city.length, 5)).toFixed(2)}cqi)` : '10cqi'
  );
  let salaryText = $derived(money(state.salary));

  function stampHtml(p: NearbyView) {
    return p.rent != null
      ? `<span class="pc-pin pc-${p.fit}">${money(p.rent)}</span>`
      : `<span class="pc-dot">${p.city}</span>`;
  }

  function pickCity(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (CITY_NAMES.includes(value)) state.set({ city: value });
  }
</script>

<svelte:head>
  <title>{v ? `${v.city}, ${v.state}` : 'City'} · Postcard preview</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Caveat:wght@500;700&family=Libre+Franklin:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="desk" style="--hue:{hue}">
  <header class="top">
    <span class="mark">Rent Tool</span>
    <label class="send">
      Send me a postcard from
      <input
        list="pc-cities"
        value={state.city}
        onchange={pickCity}
        aria-label="City"
        spellcheck="false"
      />
    </label>
    <datalist id="pc-cities">
      {#each CITY_NAMES as name (name)}<option value={name}></option>{/each}
    </datalist>
  </header>

  {#if v}
    <section class="front" class:nophoto={!v.image} aria-label="{v.city} postcard">
      {#if v.image}
        <img
          class="bg"
          src={v.image.url}
          alt=""
          style="object-position:50% {v.image.focusY ?? 50}%"
        />
      {/if}
      <div class="front-inner">
        <p class="greet">Greetings from</p>
        <h1
          class="letters"
          style="font-size:{letterSize};{v.image ? `--photo:url('${v.image.url}')` : ''}"
        >
          {v.city}
        </h1>
        <p class="state">{v.state}{v.pop ? ` · population ${compact(v.pop)}` : ''}</p>
      </div>
    </section>

    <section class="back" aria-label="What rent looks like here">
      <div class="message">
        <p>Dear you,</p>
        {#if v.rent != null}
          <p>
            A {v.housingLabel.toLowerCase()} here runs about <strong>{money(v.rent)}</strong> a
            month. On {money(v.salary)} a year you can spend up to
            <strong>{money(v.ceiling)}</strong>,
            {#if v.margin != null && v.margin >= 0}
              so you'd have about {money(v.margin)} to spare.
            {:else if v.margin != null}
              so you'd be about {money(-v.margin)} over. You'd want around {money(v.salaryNeeded)}
              a year.
            {/if}
          </p>
        {/if}
        {#if v.yoy != null}
          <p>
            Rents are {v.yoy < 0 ? 'down' : v.yoy > 0 ? 'up' : 'flat'}{v.yoy !== 0
              ? ` ${Math.abs(v.yoy)}%`
              : ''} from last year.
            {#if v.facts}
              Most folks earn around {money(v.facts.householdIncome)} a household,
              {v.facts.renterShare != null ? `${Math.round(v.facts.renterShare)}% rent,` : ''}
              {v.facts.commuteMinutes != null
                ? `and the commute is ${Math.round(v.facts.commuteMinutes)} minutes.`
                : ''}
            {/if}
          </p>
        {/if}
        <p class="sign">Wish you were here, {v.city}</p>
      </div>

      <div class="address">
        <div class="stamp pc-{v.fit}">
          <span class="stamp-rent">{money(v.rent)}</span>
          <span class="stamp-unit"
            >a month · {v.housing === '1br' ? '1BR' : v.housing === '2br' ? '2BR' : '½ 2BR'}</span
          >
        </div>
        <svg class="postmark" viewBox="0 0 120 120" aria-hidden="true">
          <defs><path id="pm-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
          <circle cx="60" cy="60" r="54" />
          <circle cx="60" cy="60" r="34" />
          <text
            ><textPath href="#pm-ring">{FIT_TEXT[v.fit].toUpperCase()} ★ {v.state} ★</textPath
            ></text
          >
          <text x="60" y="58" text-anchor="middle" class="pm-big">{money(v.ceiling)}</text>
          <text x="60" y="72" text-anchor="middle" class="pm-small">your limit</text>
        </svg>
        <p class="sr">{FIT_TEXT[v.fit]}. Your limit is {money(v.ceiling)} a month.</p>

        <div class="lines">
          <label class="line">
            <span>To someone earning</span>
            <input
              inputmode="numeric"
              value={salaryText}
              onchange={(e) => {
                const n = Number(e.currentTarget.value.replace(/[^0-9]/g, ''));
                if (n >= 10000) state.set({ salary: n });
              }}
            />
          </label>
          <label class="line">
            <span>Looking for</span>
            <select
              value={state.housing}
              onchange={(e) => state.set({ housing: e.currentTarget.value as HousingChoice })}
            >
              <option value="1br">1 bedroom</option>
              <option value="2br">2 bedrooms</option>
              <option value="shared-2br">Half of a shared 2 bedroom</option>
            </select>
          </label>
          <p class="line static">
            <span>Take-home</span>
            <b>{money(v.takeHome)} a month, about {money(v.leftover)} after rent</b>
          </p>
        </div>
      </div>
    </section>

    <section class="around">
      <div class="stamps">
        <h2>Also nearby</h2>
        <p class="hint">Rent for the same home. Pick one to read its postcard.</p>
        <ul>
          {#each v.nearby.filter((n) => n.hasData) as n (n.name)}
            <li>
              <button class="mini pc-{n.fit}" onclick={() => state.set({ city: n.name })}>
                <span class="mini-rent">{money(n.rent)}</span>
                <span class="mini-name">{n.city}</span>
                <span class="mini-meta">{n.miles} mi {n.bearing}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if v.nearby.some((n) => !n.hasData)}
          <p class="hint">
            Smaller places with no rent estimate: {v.nearby
              .filter((n) => !n.hasData)
              .map((n) => n.city)
              .join(', ')}.
          </p>
        {/if}
      </div>
      <div class="mapcard">
        <PreviewMap
          view={v}
          tiles="voyager"
          marker={stampHtml}
          center={(c) => `<span class="pc-home">${c.city}</span>`}
          onpick={(name) => state.set({ city: name })}
        />
      </div>
    </section>

    <section class="tags" aria-label="Leave to explore">
      <a class="tag" href={v.links.wikipedia} target="_blank" rel="noopener">
        <b>Read about {v.city}</b><span>Wikipedia</span>
      </a>
      <a class="tag" href={v.links.maps} target="_blank" rel="noopener">
        <b>Walk around</b><span>Google Maps</span>
      </a>
      {#each v.links.search as link (link.provider)}
        <a class="tag apt" href={link.url} target="_blank" rel="noopener">
          <b>{link.providerName}</b><span>{link.capDescription ?? 'Apartments'}</span>
        </a>
      {/each}
    </section>

    <footer class="foot">
      {#if v.image}
        Photo: <a href={v.image.photographerUrl}>{v.image.photographerName}</a> /
        {v.image.source === 'unsplash' ? 'Unsplash' : 'Wikimedia Commons'}.
      {/if}
      Rents are estimated medians from Apartment List, September 2026. Your limit is 30% of gross pay.
    </footer>
  {:else}
    <p class="missing">That city isn't in the bundled list yet. Try another.</p>
  {/if}
</div>

<PreviewBar {state} current="postcard" />

<style>
  .desk {
    --ink: #1e2a4a;
    --red: #c8342c;
    --blue: #2f5da8;
    --gold: #e8b931;
    --green: #2f7d5b;
    --card: #ffffff;
    min-height: 100vh;
    padding: 0 clamp(16px, 4vw, 48px) 96px;
    background: #c9ddea;
    color: var(--ink);
    font:
      400 16px/1.55 'Libre Franklin',
      system-ui,
      sans-serif;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    align-items: baseline;
    justify-content: space-between;
    max-width: 72rem;
    margin: 0 auto;
    padding: 20px 0;
  }
  .mark {
    font-family: 'Bowlby One', sans-serif;
    font-size: 20px;
    letter-spacing: 0.01em;
  }
  .send {
    font-weight: 500;
  }
  .send input {
    font: inherit;
    font-weight: 700;
    color: var(--ink);
    background: transparent;
    border: 0;
    border-bottom: 2px solid var(--ink);
    padding: 2px 4px;
    width: 14ch;
  }

  /* Front of the card: the photo lives inside the letters. */
  .front {
    position: relative;
    max-width: 72rem;
    margin: 0 auto;
    aspect-ratio: 16 / 8;
    min-height: 320px;
    overflow: hidden;
    border: 12px solid var(--card);
    background: hsl(var(--hue) 45% 78%);
    box-shadow:
      0 1px 0 rgb(30 42 74 / 0.15),
      0 18px 40px -18px rgb(30 42 74 / 0.45);
    transform: rotate(-0.6deg);
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(0.85) brightness(0.55) blur(2px);
    transform: scale(1.05);
  }
  .front.nophoto {
    background: repeating-linear-gradient(
      -45deg,
      hsl(var(--hue) 55% 72%) 0 22px,
      hsl(var(--hue) 55% 68%) 22px 44px
    );
  }
  .front-inner {
    position: relative;
    container-type: inline-size;
    display: grid;
    place-content: center;
    height: 100%;
    text-align: center;
    padding: 24px;
  }
  .greet {
    margin: 0 0 -0.2em;
    font:
      700 clamp(28px, 5vw, 56px) / 1 'Caveat',
      cursive;
    color: #fff;
    transform: rotate(-4deg);
    text-shadow: 0 2px 0 rgb(30 42 74 / 0.6);
  }
  .letters {
    margin: 0;
    font-family: 'Bowlby One', sans-serif;
    font-weight: 400;
    line-height: 0.95;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    color: #fff;
    background:
      var(--photo, none) center / cover,
      hsl(var(--hue) 70% 34%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-stroke: 3px #fff;
    filter: drop-shadow(6px 6px 0 var(--ink));
    word-break: break-word;
  }
  .front:not(.nophoto) .letters {
    color: transparent;
  }
  .nophoto .letters {
    color: hsl(var(--hue) 70% 34%);
    -webkit-text-stroke: 3px #fff;
  }
  .state {
    margin: 8px 0 0;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  }

  /* Back of the card. */
  .back {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    max-width: 66rem;
    margin: -28px auto 0;
    position: relative;
    background: var(--card);
    padding: clamp(20px, 4vw, 44px);
    transform: rotate(0.5deg);
    box-shadow: 0 18px 40px -20px rgb(30 42 74 / 0.5);
    border-top: 8px solid transparent;
    border-image: repeating-linear-gradient(
        -45deg,
        var(--red) 0 14px,
        #fff 14px 22px,
        var(--blue) 22px 36px,
        #fff 36px 44px
      )
      8;
  }
  .message {
    padding-right: clamp(16px, 3vw, 40px);
    border-right: 2px solid #dbe2ec;
    font:
      500 clamp(21px, 2.1vw, 26px) / 1.45 'Caveat',
      cursive;
    color: #24346b;
    max-width: 34rem;
  }
  .message p {
    margin: 0 0 0.6em;
  }
  .message strong {
    font-weight: 700;
    background: linear-gradient(transparent 62%, rgb(232 185 49 / 0.55) 62%);
  }
  .sign {
    text-align: right;
    font-weight: 700;
  }
  .address {
    position: relative;
    padding-left: clamp(16px, 3vw, 40px);
    min-height: 300px;
  }
  .stamp {
    float: right;
    width: 150px;
    height: 170px;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    color: #fff;
    background: var(--c);
    --c: #8c93a3;
    border: 7px solid transparent;
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.35);
    -webkit-mask:
      linear-gradient(#000 0 0) padding-box,
      radial-gradient(circle 4px, transparent 96%, #000) -6px -6px / 12px 12px border-box;
    mask:
      linear-gradient(#000 0 0) padding-box,
      radial-gradient(circle 4px, transparent 96%, #000) -6px -6px / 12px 12px border-box;
    outline: none;
  }
  .stamp.pc-within {
    --c: var(--green);
  }
  .stamp.pc-near {
    --c: #c08a12;
  }
  .stamp.pc-above {
    --c: var(--red);
  }
  .stamp-rent {
    font:
      400 27px/1 'Bowlby One',
      sans-serif;
  }
  .stamp-unit {
    font-size: 12px;
    font-weight: 600;
  }
  .postmark {
    position: absolute;
    top: 70px;
    right: 118px;
    width: 120px;
    fill: none;
    stroke: rgb(30 42 74 / 0.55);
    stroke-width: 2;
    transform: rotate(-14deg);
  }
  .postmark text {
    fill: rgb(30 42 74 / 0.8);
    stroke: none;
    font:
      700 8.6px 'Libre Franklin',
      sans-serif;
    letter-spacing: 0.08em;
  }
  .postmark .pm-big {
    font:
      400 15px 'Bowlby One',
      sans-serif;
    letter-spacing: 0;
  }
  .postmark .pm-small {
    font-size: 8px;
    letter-spacing: 0.04em;
  }
  .lines {
    clear: both;
    padding-top: 36px;
  }
  .line {
    display: flex;
    gap: 10px;
    align-items: baseline;
    border-bottom: 1.5px solid #b8c4d6;
    padding: 12px 0 6px;
    margin: 0;
    font-size: 13px;
    color: #56637f;
  }
  .line span {
    flex: none;
  }
  .line input,
  .line select,
  .line b {
    flex: 1;
    min-width: 0;
    font:
      700 22px/1.2 'Caveat',
      cursive;
    color: #24346b;
    border: 0;
    background: transparent;
    padding: 0;
  }
  .line input:focus-visible,
  .line select:focus-visible,
  .send input:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 3px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* Around the city. */
  .around {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: clamp(20px, 4vw, 48px);
    max-width: 72rem;
    margin: 64px auto 0;
    align-items: start;
  }
  h2 {
    margin: 0;
    font:
      400 32px/1.1 'Bowlby One',
      sans-serif;
  }
  .hint {
    margin: 6px 0 16px;
    color: #45557a;
    font-size: 14px;
  }
  .stamps ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 14px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mini {
    --c: #8c93a3;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 10px 10px;
    border: 0;
    cursor: pointer;
    background: #fff;
    color: var(--ink);
    text-align: left;
    font: inherit;
    box-shadow: inset 0 0 0 3px var(--c);
    background-color: #fff;
    border: 6px solid transparent;
    -webkit-mask:
      linear-gradient(#000 0 0) padding-box,
      radial-gradient(circle 3px, transparent 96%, #000) -5px -5px / 10px 10px border-box;
    mask:
      linear-gradient(#000 0 0) padding-box,
      radial-gradient(circle 3px, transparent 96%, #000) -5px -5px / 10px 10px border-box;
    transition: transform 120ms ease;
  }
  .mini:hover {
    transform: rotate(-2deg) translateY(-2px);
  }
  .mini:focus-visible {
    outline: 3px solid var(--blue);
  }
  .mini.pc-within {
    --c: var(--green);
  }
  .mini.pc-near {
    --c: #c08a12;
  }
  .mini.pc-above {
    --c: var(--red);
  }
  .mini-rent {
    font:
      400 20px/1 'Bowlby One',
      sans-serif;
    color: var(--c);
  }
  .mini-name {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.2;
  }
  .mini-meta {
    font-size: 12px;
    color: #56637f;
  }
  .mapcard {
    height: 440px;
    border: 10px solid #fff;
    box-shadow: 0 18px 40px -20px rgb(30 42 74 / 0.5);
    transform: rotate(1deg);
    background: #e8eef3;
  }
  .mapcard :global(.pc-pin) {
    --c: #8c93a3;
    display: inline-block;
    transform: translate(-50%, -50%);
    padding: 3px 6px;
    background: #fff;
    color: var(--c);
    border: 2px solid var(--c);
    font:
      400 12px/1 'Bowlby One',
      sans-serif;
    white-space: nowrap;
    cursor: pointer;
  }
  .mapcard :global(.pc-pin.pc-within) {
    --c: #2f7d5b;
  }
  .mapcard :global(.pc-pin.pc-near) {
    --c: #c08a12;
  }
  .mapcard :global(.pc-pin.pc-above) {
    --c: #c8342c;
  }
  .mapcard :global(.pc-dot) {
    display: inline-block;
    transform: translate(-4px, -4px);
    padding-left: 12px;
    font-size: 11px;
    color: #56637f;
    white-space: nowrap;
    background: radial-gradient(circle 4px at 4px 50%, #56637f 90%, transparent) no-repeat;
  }
  .mapcard :global(.pc-home) {
    display: inline-block;
    transform: translate(-50%, -50%);
    padding: 6px 10px;
    background: #1e2a4a;
    color: #fff;
    font:
      400 14px/1 'Bowlby One',
      sans-serif;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Luggage tags out. */
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    max-width: 72rem;
    margin: 56px auto 0;
  }
  .tag {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 12px 18px 12px 34px;
    background: #f2d68a;
    color: var(--ink);
    text-decoration: none;
    clip-path: polygon(16px 0, 100% 0, 100% 100%, 16px 100%, 0 50%);
  }
  .tag::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 50%;
    width: 9px;
    height: 9px;
    margin-top: -4.5px;
    border-radius: 50%;
    background: #c9ddea;
  }
  .tag.apt {
    background: #fff;
  }
  .tag b {
    font-size: 15px;
  }
  .tag span {
    font-size: 12px;
    color: #56637f;
  }
  .tag:hover b {
    text-decoration: underline;
  }
  .tag:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .foot {
    max-width: 72rem;
    margin: 40px auto 0;
    font-size: 12px;
    color: #45557a;
  }
  .foot a {
    color: inherit;
  }
  .missing {
    text-align: center;
    padding: 4rem 0;
  }

  @media (max-width: 760px) {
    .front {
      aspect-ratio: auto;
      min-height: 260px;
      border-width: 8px;
    }
    .back {
      grid-template-columns: 1fr;
      margin-top: -12px;
    }
    .message {
      border-right: 0;
      border-bottom: 2px solid #dbe2ec;
      padding: 0 0 16px;
    }
    .address {
      padding: 20px 0 0;
    }
    .postmark {
      right: 120px;
      top: 20px;
    }
    .around {
      grid-template-columns: 1fr;
    }
    .mapcard {
      height: 340px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mini {
      transition: none;
    }
  }
</style>
