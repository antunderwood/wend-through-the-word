<script lang="ts">
  // The bottom sheet of the phone layout (decision 115): a handle on its top edge opens and closes
  // it, and the panels it holds are its tabs. A tab is one more entry in tabs; each tab's body stays
  // mounted while another tab shows, so it keeps its place. shown is the height it takes at the
  // bottom of the screen, open or closed.
  import type { Snippet } from "svelte";

  type Tab = { id: string; name: string; body: Snippet };
  let {
    tabs,
    tab = $bindable(tabs[0].id),
    collapsed = $bindable(false),
    shown = $bindable(0),
  }: { tabs: Tab[]; tab?: string; collapsed?: boolean; shown?: number } = $props();

  let height = $state(0),
    handle = $state(0);
  $effect(() => {
    shown = collapsed ? handle + 1 : height; // and the top border
  });
</script>

<section class="sheet" class:collapsed aria-label="Sheet" bind:offsetHeight={height}>
  <button class="handle" aria-controls="sheet-body" aria-expanded={!collapsed} aria-label={collapsed ? "Open the sheet" : "Close the sheet"} onclick={() => (collapsed = !collapsed)} bind:clientHeight={handle}>
    <span class="grip"></span>
  </button>
  <div id="sheet-body" class="body">
    <div class="tabs" role="tablist" aria-label="Sheet">
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
     floats at the bottom of the screen sits above --sheet-shown. */
  :global(html:has(.sheet)) {
    --sheet: 46dvh;
    --sheet-shown: var(--sheet);
  }
  :global(html:has(.sheet.collapsed)) {
    --sheet-shown: 45px; /* the handle and the top border */
  }
  .sheet {
    --handle: 44px;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
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
    transform: translateY(calc(100% - var(--handle) - 1px)); /* and the top border */
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }
  .handle {
    flex: none;
    height: var(--handle);
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
