<script lang="ts" generics="Value extends string">
  import { tick, onDestroy } from 'svelte';

  let {
    id,
    label,
    value,
    options,
    onchange
  }: {
    id: string;
    label: string;
    value: Value;
    options: readonly { value: Value; label: string; disabled?: boolean }[];
    onchange: (value: Value) => void;
  } = $props();

  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  let root: HTMLDivElement;
  let open = $state(false);
  let active = $state(-1);
  let left = $state(0);
  let edge = $state(0);
  let width = $state(0);
  let height = $state(320);
  let above = $state(false);
  let search = '';
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let selected = $derived(options.find((option) => option.value === value));

  function position() {
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const availableAbove = rect.top - 16;
    above = below < 240 && availableAbove > below;
    height = Math.max(44, Math.min(320, above ? availableAbove : below));
    width = Math.min(Math.max(rect.width, 220), window.innerWidth - 32);
    left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    edge = above ? window.innerHeight - rect.top + 6 : rect.bottom + 6;
  }

  async function highlight(index: number) {
    active = index;
    await tick();
    const item = menu?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!menu || !item) return;
    // Scroll only the option list; scrolling a top-layer item into view can move the page.
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight)
      menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
  }

  async function show(
    index = options.findIndex((option) => option.value === value && !option.disabled)
  ) {
    if (!options.some((option) => !option.disabled)) return;
    position();
    open = true;
    active = index >= 0 ? index : options.findIndex((option) => !option.disabled);
    await tick();
    if (!open || !menu) return;
    menu.showPopover?.();
    await highlight(active);
  }

  function close() {
    open = false;
    search = '';
    clearTimeout(searchTimer);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    close();
    onchange(option.value);
    trigger.focus({ preventScroll: true });
  }

  function move(direction: number) {
    for (let step = 1; step <= options.length; step += 1) {
      const index = (active + direction * step + options.length) % options.length;
      if (!options[index].disabled) {
        void highlight(index);
        return;
      }
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      return;
    }
    if (
      ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key) &&
      (event.key !== ' ' || !search)
    ) {
      event.preventDefault();
      search = '';
      clearTimeout(searchTimer);
      if (event.key === 'Home' || event.key === 'End') {
        const indices = options
          .map((option, index) => (option.disabled ? -1 : index))
          .filter((index) => index >= 0);
        const index = event.key === 'Home' ? indices[0] : indices.at(-1);
        if (index != null) {
          if (open) void highlight(index);
          else void show(index);
        }
      } else if (!open) void show();
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        move(event.key === 'ArrowDown' ? 1 : -1);
      else choose(active);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      clearTimeout(searchTimer);
      search += event.key.toLocaleLowerCase();
      const query = [...search].every((character) => character === search[0]) ? search[0] : search;
      const start = open ? active + (query.length === 1 ? 1 : 0) : 0;
      for (let step = 0; step < options.length; step += 1) {
        const index = (start + step) % options.length;
        if (
          !options[index].disabled &&
          options[index].label.toLocaleLowerCase().startsWith(query)
        ) {
          if (open) void highlight(index);
          else void show(index);
          break;
        }
      }
      searchTimer = setTimeout(() => (search = ''), 600);
    }
  }

  function outside(event: Event) {
    if (open && event.target instanceof Node && !root.contains(event.target)) close();
  }

  $effect(() => {
    if (!open) return;
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  });
  onDestroy(() => clearTimeout(searchTimer));
</script>

<svelte:window onpointerdown={outside} onfocusin={outside} />

<div bind:this={root} class="min-w-0">
  <label id={`${id}-label`} for={id} class="mb-2 block text-label text-muted">{label}</label>
  <button
    bind:this={trigger}
    {id}
    type="button"
    role="combobox"
    aria-labelledby={`${id}-label`}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={open ? `${id}-options` : undefined}
    aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
    data-value={value}
    onclick={() => (open ? close() : void show())}
    onkeydown={keydown}
    class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-semibold transition-colors {open
      ? 'border-accent bg-card text-ink'
      : 'border-line-strong bg-card-2 text-ink hover:border-accent hover:bg-card'}"
  >
    <span class="truncate">{selected?.label ?? 'Choose an option'}</span>
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      class="size-5 shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}"
      ><path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
  </button>

  {#if open}
    <div
      bind:this={menu}
      id={`${id}-options`}
      popover="manual"
      role="listbox"
      aria-labelledby={`${id}-label`}
      style={`left:${left}px;${above ? 'bottom' : 'top'}:${edge}px;width:${width}px;max-height:${height}px`}
      class="fixed inset-auto z-50 m-0 overflow-y-auto overscroll-contain rounded-md border border-line-strong bg-card p-1.5 text-ink shadow-pop"
    >
      {#each options as option, index (option.value)}
        <!-- svelte-ignore a11y_interactive_supports_focus (Focus stays on the combobox; aria-activedescendant identifies the active option.) -->
        <div
          id={`${id}-option-${index}`}
          role="option"
          aria-selected={option.value === value}
          aria-disabled={option.disabled ? 'true' : undefined}
          data-value={option.value}
          data-index={index}
          onpointerdown={(event) => event.preventDefault()}
          onpointermove={() => {
            if (!option.disabled) active = index;
          }}
          onclick={() => choose(index)}
          onkeydown={keydown}
          class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors {option.disabled
            ? 'cursor-not-allowed text-faint'
            : 'cursor-pointer'} {option.disabled
            ? ''
            : option.value === value
              ? 'bg-accent-soft font-semibold text-accent'
              : active === index
                ? 'bg-card-2 text-ink'
                : 'text-ink'}"
        >
          <span>{option.label}</span>
          {#if option.value === value}<svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              class="size-4 shrink-0"
              ><path
                d="m4 10 4 4 8-8"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
