<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Page unavailable'} · Renttool</title>
</svelte:head>

<main id="main-content" class="grid min-h-dvh place-items-center px-4 py-20">
  <section class="max-w-xl rounded-2xl bg-card-2 p-8 md:p-12">
    <p class="text-label text-accent tabular-nums">{page.status}</p>
    <h1 class="mt-4 text-headline">
      {page.status === 404 ? 'This page is not on the map.' : 'This page is unavailable.'}
    </h1>
    <p class="mt-4 text-body text-muted">
      {page.status === 404
        ? 'Return to the calculator and start with a city you are considering.'
        : 'Please return to the calculator and try again.'}
    </p>
    <a
      class="mt-8 inline-flex rounded-xl bg-accent px-3 py-2 text-base font-semibold text-accent-ink transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-accent-deep active:translate-y-px active:scale-98"
      href="/"
    >
      Back to Renttool
    </a>
  </section>
</main>
