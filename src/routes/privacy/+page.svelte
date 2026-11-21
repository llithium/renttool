<svelte:head>
  <title>Privacy · Renttool</title>
  <meta name="description" content="How Renttool handles the information used in your rent plan." />
</svelte:head>

<main id="main-content" class="mx-auto max-w-3xl px-4 pt-12 pb-20 md:px-6 md:pt-16 md:pb-24">
  <a class="text-sm font-semibold text-accent" href="/">← Back to Renttool</a>
  <h1 class="mt-8 text-headline">Privacy</h1>
  <div class="mt-8 max-w-[68ch] space-y-6 text-body text-muted">
    <p>
      Renttool does not require an account. Your selected cities and salary plan are stored in your
      browser and reflected in the page address so the plan can be restored or shared.
    </p>
    <p>
      Share plan defaults to a cities-only link, excluding financial details. Share full plan
      includes salary, take-home pay, expenses, savings, buffer, and city expense overrides. Copying
      the page address directly also includes the financial details shown there. Apartment-check
      inputs are temporary and are excluded from shared links. Discovery filters are saved for this
      browser tab’s session.
    </p>
    <p>
      Requests for city and location data may include the city name or coordinates needed to return
      a result. Renttool does not sell personal information.
    </p>
    <p>
      Commute searches send your entered address to Photon through our server. Choosing a
      destination sends its coordinates and city-center coordinates to the routing provider (FOSSGIS
      by default), which may retain request logs. Your chosen destination and maximum drive time are
      saved separately for each city in this browser so they carry between Plan and Compare. They
      are excluded from shared links and the page address. Use Clear in the commute controls to
      remove the saved destination, or clear browser storage to remove all commute settings.
    </p>
    <p>
      City pages may load a representative image from the checked-in image manifest. The browser
      loads that image from Unsplash or Wikimedia, but Renttool does not send the city name to an
      image-search API at runtime.
    </p>
    <p>
      City pages ask Wikipedia for a short summary of the city. Your browser sends the city and
      state name to Wikipedia to get it; nothing about your salary or plan is included.
    </p>
    <p>
      Clear your browser storage or remove the plan details from the page address to reset them.
    </p>
  </div>
</main>
