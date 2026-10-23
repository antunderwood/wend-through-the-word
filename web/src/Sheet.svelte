<script lang="ts" generics="Id extends string">
  // The bottom sheet of the phone layout (decision 115): its top row holds the tabs and the handle,
  // and the panels it holds are its tabs. A tab is one more entry in tabs; each tab's body stays
  // mounted while another tab shows, so it keeps its place. A tap on the handle opens and closes it;
  // a drag on the row moves its top edge with the finger and, on release, snaps to the nearest of
  // closed (the row only), half the screen, and nearly the whole screen (full). On a screen wider
  // than it is tall (side) it is a full-height side panel on the right instead, its handle at the
  // start of the row, and it does not drag (decision 184). covered is the px it covers at the bottom
  // of the screen, or at the right when at the side, open or closed.
  import { tick, type Snippet } from "svelte";

  type Tab = { id: Id; name: string; body: Snippet };
  let {
    tabs,
    tab = $bindable(tabs[0].id),
    collapsed = $bindable(false),
    full = $bindable(false),
    covered = $bindable(0),
    side = false,
  }: { tabs: Tab[]; tab?: Id; collapsed?: boolean; full?: boolean; covered?: number; side?: boolean } = $props();

  let sheet: HTMLElement, row: HTMLElement;
  // Open, the sheet is half the screen or, dragged up, full. The styles set both heights; the probes
  // read them in px. Closed, the row shows with the border; --sheet-handle is its height.
  let height = $state(0),
    width = $state(0),
    halfPx = $state(0),
    fullPx = $state(0);
  const closedPx = () => parseFloat(getComputedStyle(sheet).getPropertyValue("--sheet-handle")) + 1;
  // The px the sheet shows while a finger drags it; null when no drag is under way.
  let dragging = $state<number | null>(null);
  // The camera offset follows the sheet's height once a drag ends, not every move of the finger.
  $effect(() => {
    if (dragging !== null) return;
    covered = collapsed ? closedPx() : side ? width : height;
  });

  // The on-screen keyboard, or a browser's toolbar, lies over the bottom of the page and shrinks the
  // visual viewport, not the page. The sheet sits above it (--keyboard is its height), from the
  // first frame, and a field being typed in stays in view, its end (where the typing is) foremost
  // when the sheet is too short for all of it.
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
    follow();
    vv.addEventListener("resize", follow);
    vv.addEventListener("scroll", follow);
    return () => {
      vv.removeEventListener("resize", follow);
      vv.removeEventListener("scroll", follow);
      root.style.removeProperty("--keyboard");
    };
  });

  // A drag starts once the finger has moved a few px up or down from where it touched the row, so a
  // tap on a tab or the handle is still a tap; the tap that ends a drag is not one.
  let press: { y: number; shown: number } | undefined,
    dragged = false;
  const shown = () => (collapsed ? closedPx() : full ? fullPx : halfPx);
  function down(e: PointerEvent) {
    dragged = false;
    if (!side && e.isPrimary) press = { y: e.clientY, shown: shown() };
  }
  function move(e: PointerEvent) {
    if (!press) return;
    const dy = press.y - e.clientY;
    if (dragging === null && Math.abs(dy) < 6) return;
    if (dragging === null) row.setPointerCapture(e.pointerId);
    dragging = Math.max(closedPx(), Math.min(fullPx, press.shown + dy));
  }
  function up() {
    press = undefined;
    if (dragging === null) return;
    const at = dragging;
    const [nearest] = [closedPx(), halfPx, fullPx].sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
    collapsed = nearest !== halfPx && nearest !== fullPx;
    full = nearest === fullPx && !collapsed;
    dragging = null;
    dragged = true;
  }
  function cancel() {
    press = undefined;
    dragging = null;
  }
  function swallow(e: MouseEvent) {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }

  // Up and Down on the handle step through closed, half, and full, as a drag does.
  function stepHeight(e: KeyboardEvent) {
    if (side || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    if (e.key === "ArrowUp") [full, collapsed] = [!collapsed, false];
    else [full, collapsed] = [false, !full];
  }

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

  // Below half, a dragged sheet slides down as a closed one does; above it, it grows.
  const dragHeight = $derived(dragging === null ? undefined : `${Math.max(dragging, halfPx)}px`);
  const dragShift = $derived(dragging === null ? undefined : `translateY(${Math.max(0, halfPx - dragging)}px)`);
</script>

<section
  class="sheet"
  class:collapsed
  class:side
  class:full={full && !side}
  class:dragging={dragging !== null}
  style:height={dragHeight}
  style:transform={dragShift}
  aria-label="Sheet"
  data-tour="sheet"
  bind:offsetHeight={height}
  bind:offsetWidth={width}
  bind:this={sheet}
>
  <span class="probe half" aria-hidden="true" bind:offsetHeight={halfPx}></span>
  <span class="probe whole" aria-hidden="true" bind:offsetHeight={fullPx}></span>
  <!-- The drag is for a finger or a mouse; the keyboard and a screen reader have the handle and the tabs. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="row" bind:this={row} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel} onclickcapture={swallow}>
    <div class="tabs" role="tablist" aria-label="Sheet" tabindex="-1" onkeydown={stepTab}>
      {#each tabs as t (t.id)}
        <!-- A tab tapped on a closed sheet opens it. -->
        <button
          role="tab"
          id="tab-{t.id}"
          aria-controls="tabpanel-{t.id}"
          aria-selected={tab === t.id}
          tabindex={tab === t.id ? 0 : -1}
          onclick={() => {
            tab = t.id;
            collapsed = false;
          }}>{t.name}</button
        >
      {/each}
    </div>
    <button
      class="handle"
      aria-controls="sheet-body"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Open the sheet" : "Close the sheet"}
      onclick={() => {
        collapsed = !collapsed;
        full = false;
      }}
      onkeydown={stepHeight}
    >
      <span class="grip"></span>
    </button>
  </div>
  <div id="sheet-body" class="body">
    {#each tabs as t (t.id)}
      <div class="tabpanel" role="tabpanel" id="tabpanel-{t.id}" aria-labelledby="tab-{t.id}" hidden={tab !== t.id}>{@render t.body()}</div>
    {/each}
  </div>
</section>

<style>
  /* Half is 46% of the height (the navigation prototype's finding); full leaves the top bar and a
     strip of the scene in view; closed, only the row shows. What floats at the bottom of the screen
     sits above --sheet-covered, which counts the keyboard. */
  :global(html:has(.sheet)) {
    --sheet-half: min(46dvh, 100dvh - var(--keyboard, 0px) - 160px); /* with the keyboard up, room above for the controls */
    --sheet-full: max(var(--sheet-half), 100dvh - var(--keyboard, 0px) - var(--bar, 40px) - 80px);
    --sheet: var(--sheet-half);
    --sheet-handle: 44px;
    --sheet-covered: calc(var(--sheet) + var(--keyboard, 0px));
  }
  :global(html:has(.sheet.full)) {
    --sheet: var(--sheet-full);
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
    transition:
      transform 0.2s,
      height 0.2s;
  }
  .sheet.collapsed {
    transform: translateY(calc(100% - var(--sheet-handle) - 1px)); /* and the top border */
  }
  /* The finger moves the sheet: no easing behind it. */
  .sheet.dragging {
    transition: none;
  }
  .probe {
    position: absolute;
    width: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .probe.half {
    height: var(--sheet-half);
  }
  .probe.whole {
    height: var(--sheet-full);
  }
  /* At the side the handle starts the row, and the open tab is below it. Closed, only the handle's
     column shows at the right edge. */
  .sheet.side {
    top: 0;
    left: auto;
    width: var(--sheet-width);
    height: auto;
    border-top: 0;
    border-left: 1px solid #262a3c;
    border-radius: 14px 0 0 14px;
  }
  .sheet.side .handle {
    flex: none;
    order: -1;
    width: var(--sheet-handle);
    border-right: 1px solid #262a3c;
  }
  .sheet.side .tabs {
    padding-left: 0;
  }
  .sheet.side.collapsed {
    transform: translateX(calc(100% - var(--sheet-handle) - 1px)); /* and the left border */
  }
  .sheet.side.collapsed .tabpanel {
    visibility: hidden;
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
  /* The tabs, then the handle across the rest of the row; a finger on the row drags the sheet, not
     the page. */
  .row {
    flex: none;
    display: flex;
    height: var(--sheet-handle);
    border-bottom: 1px solid #262a3c;
    touch-action: none;
  }
  .handle {
    flex: auto;
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
    padding: 0 0 0 16px;
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
