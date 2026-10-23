<script lang="ts" generics="Id extends string">
  // The bottom sheet of the phone layout (decision 115): a handle on its top edge opens and closes
  // it, and the panels it holds are its tabs. A tab is one more entry in tabs; each tab's body stays
  // mounted while another tab shows, so it keeps its place. On a screen wider than it is tall (side)
  // it is a full-height side panel on the right instead, its handle at the start of the tab row
  // (decision 184). covered is the px it covers at the bottom of the screen, or at the right when at
  // the side, open or closed.
  import { tick, type Snippet } from "svelte";

  type Tab = { id: Id; name: string; body: Snippet };
  let {
    tabs,
    tab = $bindable(tabs[0].id),
    collapsed = $bindable(false),
    covered = $bindable(0),
    side = false,
  }: { tabs: Tab[]; tab?: Id; collapsed?: boolean; covered?: number; side?: boolean } = $props();

  let sheet: HTMLElement;
  // Closed, the handle shows with the border; the styles' --sheet-handle is its height (its width at
  // the side).
  let height = $state(0),
    width = $state(0);
  $effect(() => {
    covered = collapsed ? parseFloat(getComputedStyle(sheet).getPropertyValue("--sheet-handle")) + 1 : side ? width : height;
  });

  // The on-screen keyboard lies over the bottom of the page and shrinks the visual viewport, not the
  // page. The sheet sits above it (--keyboard is its height), and a field being typed in stays in view,
  // its end (where the typing is) foremost when the sheet is too short for all of it.
  $effect(() => {
    const vv = visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const follow = () => {
      root.style.setProperty("--keyboard", `${Math.max(0, innerHeight - vv.height - vv.offsetTop)}px`);
      requestAnimationFrame(() => {
        const typing = document.activeElement;
        if (typing && sheet.contains(typing) && typing.matches("input, textarea")) typing.scrollIntoView({ block: "end" });
      });
    };
    vv.addEventListener("resize", follow);
    return () => {
      vv.removeEventListener("resize", follow);
      root.style.removeProperty("--keyboard");
    };
  });

  // Left and Right step through the tabs, round from the last to the first, and Home and End go to
  // the first and the last; the tab moved to opens and takes the keyboard, as in an ARIA tab list.
  async function stepTab(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === tab),
      n = tabs.length;
    const to = { ArrowLeft: i - 1 + n, ArrowRight: i + 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    tab = tabs[to % n].id;
    await tick();
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-selected="true"]')!.focus();
  }
</script>

<section class="sheet" class:collapsed class:side aria-label="Sheet" data-tour="sheet" bind:offsetHeight={height} bind:offsetWidth={width} bind:this={sheet}>
  <button class="handle" aria-controls="sheet-body" aria-expanded={!collapsed} aria-label={collapsed ? "Open the sheet" : "Close the sheet"} onclick={() => (collapsed = !collapsed)}>
    <span class="grip"></span>
  </button>
  <div id="sheet-body" class="body">
    <div class="tabs" role="tablist" aria-label="Sheet" tabindex="-1" onkeydown={stepTab}>
      {#each tabs as t (t.id)}
        <button role="tab" id="tab-{t.id}" aria-controls="tabpanel-{t.id}" aria-selected={tab === t.id} tabindex={tab === t.id ? 0 : -1} onclick={() => (tab = t.id)}>{t.name}</button>
      {/each}
    </div>
    {#each tabs as t (t.id)}
      <div class="tabpanel" role="tabpanel" id="tabpanel-{t.id}" aria-labelledby="tab-{t.id}" hidden={tab !== t.id}>{@render t.body()}</div>
    {/each}
  </div>
</section>

<style>
  /* 46% of the height (the navigation prototype's finding); closed, only the handle shows. What
     floats at the bottom of the screen sits above --sheet-covered, which counts the keyboard. */
  :global(html:has(.sheet)) {
    --sheet: min(46dvh, 100dvh - var(--keyboard, 0px) - 160px); /* with the keyboard up, room above for the controls */
    --sheet-handle: 44px;
    --sheet-covered: calc(var(--sheet) + var(--keyboard, 0px));
  }
  :global(html:has(.sheet.collapsed)) {
    --sheet-covered: calc(var(--sheet-handle) + 1px + var(--keyboard, 0px)); /* and the top border */
  }
  /* At the side: the whole height, about 40% of the width (at least 320 px, for the row of controls
     at the top of the Details tab), and what floats at the right of the screen sits left of
     --sheet-covered. */
  :global(html[data-side]:has(.sheet)) {
    --sheet: calc(100dvh - var(--keyboard, 0px));
    --sheet-width: max(40vw, 320px);
    --sheet-covered: var(--sheet-width);
  }
  :global(html[data-side]:has(.sheet.collapsed)) {
    --sheet-covered: calc(var(--sheet-handle) + 1px); /* and the left border */
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--keyboard, 0px);
    height: var(--sheet);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: #121520;
    border-top: 1px solid #262a3c;
    border-radius: 14px 14px 0 0;
    transition: transform 0.2s;
  }
  .sheet.collapsed {
    transform: translateY(calc(100% - var(--sheet-handle) - 1px)); /* and the top border */
  }
  /* At the side the handle starts the row of tabs, and the open tab is below them. Closed, only the
     handle's column shows at the right edge. */
  .sheet.side {
    top: 0;
    left: auto;
    width: var(--sheet-width);
    height: auto;
    display: grid;
    grid-template: auto 1fr / var(--sheet-handle) 1fr;
    border-top: 0;
    border-left: 1px solid #262a3c;
    border-radius: 14px 0 0 14px;
  }
  .sheet.side .body {
    display: contents;
  }
  .sheet.side .tabs {
    padding-left: 0;
  }
  .sheet.side .tabpanel {
    grid-column: 1 / -1;
  }
  .sheet.side.collapsed {
    transform: translateX(calc(100% - var(--sheet-handle) - 1px)); /* and the left border */
  }
  .sheet.side.collapsed .tabpanel {
    visibility: hidden;
  }
  .sheet.side .handle {
    border-bottom: 1px solid #262a3c;
  }
  .sheet.side .grip {
    width: 4px;
    height: 24px;
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }
  .handle {
    flex: none;
    height: var(--sheet-handle);
    border: 0;
    background: none;
    cursor: pointer;
  }
  .grip {
    display: block;
    width: 40px;
    height: 4px;
    margin: 0 auto;
    border-radius: 999px;
    background: #3a4060;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .tabs {
    flex: none;
    display: flex;
    gap: 4px;
    padding: 0 16px;
    border-bottom: 1px solid #262a3c;
  }
  .tabs button {
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: #9aa0b4;
    font: inherit;
    padding: 0 12px;
    cursor: pointer;
  }
  .tabs button[aria-selected="true"] {
    border-bottom-color: #ffd27a;
    color: #ffd27a;
  }
  .tabpanel {
    flex: 1;
    min-height: 0;
  }
  /* Large enough to tap: every button and list row in the sheet is at least 44 px tall. */
  .sheet :global(button),
  .sheet :global(li) {
    min-height: 44px;
  }
</style>
