<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { rentPlanPresentation as plan } from '$lib/rentPlanPresentation.svelte';
  import { createSalaryField } from '$lib/salaryField.svelte';
  import HomeView from '$lib/components/postcard/HomeView.svelte';

  // Home always shows the start page. The last session still fills in the
  // salary, housing, and comparison, and the city page lives at /city.
  let hydrated = $state(false);
  let salaryTimer: ReturnType<typeof setTimeout> | undefined;

  const salary = createSalaryField((value) => {
    plan.setSalary(value);
    clearTimeout(salaryTimer);
    salaryTimer = setTimeout(() => {
      const search = new URLSearchParams(location.search);
      if (value != null) search.set('salary', String(value));
      else search.delete('salary');
      const query = search.toString();
      replaceState(query ? `?${query}` : location.pathname, history.state ?? {});
    }, 350);
  });

  onMount(() => {
    const hadUrlState = plan.hydrateFromSearch(page.url.searchParams);
    if (!hadUrlState) {
      const urlSalary = plan.salary;
      if (!plan.activeCity && !plan.comparisonNames.length) plan.restoreSession();
      if (urlSalary != null) plan.setSalary(urlSalary);
    }
    salary.reseed(plan.salary);
    hydrated = true;
    return () => {
      clearTimeout(salaryTimer);
      plan.flushPersistence();
    };
  });
</script>

<svelte:head>
  <title>Renttool · Find your city. Know your rent.</title>
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

<main id="main-content" tabindex="-1" data-hydrated={hydrated ? 'true' : 'false'}>
  <HomeView presentation={plan} {salary} />
</main>

<style>
  main {
    min-height: 100vh;
    outline: none;
  }
</style>
