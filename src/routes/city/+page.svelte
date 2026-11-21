<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createSalaryField } from '$lib/salaryField.svelte';
  import { createUrlSync } from '$lib/urlSync.svelte';
  import CityView from '$lib/components/postcard/CityView.svelte';

  const urlSync = createUrlSync(plan);
  const salary = createSalaryField((value) => {
    plan.setSalary(value);
    urlSync.scheduleSalary(value);
  });

  let selected = $derived(plan.activeCity);
  let apartmentOpen = $state(false);

  function revealLinkedSection() {
    if (window.location.hash === '#apartment-check') apartmentOpen = true;
  }

  // With no city in the link or the last session, the home page is where to start.
  $effect(() => {
    if (!urlSync.hydrated || selected || plan.looking) return;
    const home = plan.salary != null ? `/?salary=${plan.salary}` : '/';
    const timer = setTimeout(() => void goto(home, { replaceState: true }));
    return () => clearTimeout(timer);
  });

  onMount(() => {
    revealLinkedSection();
    const teardown = urlSync.start(page.url.searchParams, () => salary.reseed(plan.salary));
    return () => {
      plan.flushPersistence();
      teardown();
    };
  });
</script>

<svelte:head>
  <title>{selected ? `${selected.name} rent on a salary · Renttool` : 'Renttool'}</title>
  <meta
    name="description"
    content="Put in a salary offer and a city. See the rent there, what you'd keep each month, and the towns around it."
  />
  <meta property="og:title" content="Renttool · Find your city. Know your rent." />
  <meta
    property="og:description"
    content="Turn a salary offer into a rent ceiling and see how a city and its nearby towns measure up."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/renttool-icon.png" />
</svelte:head>

<svelte:window onhashchange={revealLinkedSection} />

<main id="main-content" tabindex="-1" data-hydrated={urlSync.hydrated ? 'true' : 'false'}>
  {#if urlSync.hydrated && selected}
    <CityView presentation={plan} city={selected} {salary} bind:apartmentOpen />
  {:else}
    <div class="pc-wrap" aria-busy="true" aria-label="Loading your rent plan">
      <div class="pc-loading pc-card"></div>
    </div>
  {/if}
</main>

<style>
  main {
    min-height: 100vh;
    outline: none;
  }
  .pc-loading {
    height: 40rem;
    margin-top: 5.5rem;
    background: linear-gradient(90deg, #fff 44%, #f2f4f5 44%);
  }
</style>
