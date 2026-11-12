<script lang="ts">
  // The reader as a HUD-styled modal (decision 239): where the Selected Node shows on the HUD, the chapter
  // opens on a card of the same make (cut corners, cyan line, see-through glass) instead of the left
  // drawer or the sheet's Reader tab. It is the Reader component inside a frame; the reader's own colours
  // are the HUD's through the custom properties set here. Desktop: a card at the left of the scene, so
  // the graph and the HUD stay in view and a tapped Verse shows on the HUD. Phone: a card over the docked HUD.
  import type { Snippet } from "svelte";
  import { chamfer, clipPath, svgPoints } from "./hud";

  let { children, onclose, phone = false }: { children: Snippet; onclose: () => void; phone?: boolean } = $props();

  const CUT = 18;
  let w = $state(0);
  let h = $state(0);
  const outline = $derived(chamfer(w, h, CUT, 0.5));
  // Esc closes it, unless a field has the key (none here, but the correction dialog may sit over it).
  function key(e: KeyboardEvent) {
    if (e.key === "Escape" && !e.defaultPrevented && !(e.target as Element | null)?.closest("dialog, input, textarea")) onclose();
  }
</script>

<svelte:window onkeydown={key} />
<div class="modal" class:phone aria-label="Reader (HUD)" role="group" bind:clientWidth={w} bind:clientHeight={h}>
  <div class="glass" style:clip-path={clipPath(outline)}></div>
  <svg class="frame" aria-hidden="true">
    <polygon points={svgPoints(outline)} />
    <path d="M{CUT + 10},4.5H{CUT + 70}M{w - 64},{h - 4.5}H{w - CUT - 10}" />
  </svg>
  <div class="body">{@render children()}</div>
</div>

<style>
  .modal {
    /* The reader's own tokens, in the HUD's palette. */
    --text: rgb(var(--hud-ink));
    --text-soft: rgba(var(--hud-ink), 0.8);
    --muted: rgba(var(--hud-ink), 0.6);
    --accent: rgb(var(--hud-line));
    --accent-tint: rgba(var(--hud-line), 0.2);
    --control: rgba(var(--hud-line), 0.1);
    --line-strong: rgba(var(--hud-line), 0.6);
    position: fixed;
    top: 72px;
    left: 16px;
    bottom: 96px;
    width: min(440px, calc(100vw - 32px));
    z-index: 4; /* with the HUD; the search results (5) and the tour (10) stay over it */
    box-sizing: border-box;
    padding: 12px 18px 14px;
    color: var(--text);
    isolation: isolate;
    display: flex;
    flex-direction: column;
  }
  /* Phone: across the screen over the docked HUD, from under the top bar to the bottom edge. */
  .modal.phone {
    left: var(--edge);
    right: var(--edge);
    width: auto;
    top: 64px;
    bottom: calc(var(--keyboard, 0px) + var(--edge));
    padding: 10px 12px 12px;
  }
  .body {
    flex: 1;
    min-height: 0;
  }
  .glass,
  .frame {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  /* Near solid: a chapter is long text, and the graph's names must not show through it. */
  .glass {
    background:
      repeating-linear-gradient(0deg, rgba(var(--hud-line), 0.035) 0 1px, transparent 1px 3px),
      linear-gradient(160deg, rgba(var(--hud-line), 0.12), rgba(var(--hud-deep), 0.1) 40%, rgba(var(--hud-deep), 0.1)),
      linear-gradient(rgba(var(--hud-deep), 0.97), rgba(var(--hud-deep), 0.97));
    backdrop-filter: blur(6px) saturate(1.2);
    -webkit-backdrop-filter: blur(6px) saturate(1.2);
  }
  .frame {
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 0 3px rgba(var(--hud-line), 0.7));
  }
  .frame polygon {
    fill: none;
    stroke: rgba(var(--hud-line), 0.75);
  }
  .frame path {
    stroke: rgba(var(--hud-line), 0.95);
    stroke-width: 3;
  }
  /* The chapter's title and its buttons in the HUD's type and cut-corner style. */
  .modal :global(h2) {
    font: 600 var(--fs-lg) ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(var(--hud-line), 0.45);
  }
  .modal :global(header button) {
    border: 0;
    border-radius: 0;
    color: rgb(var(--hud-line));
    box-shadow: inset 0 0 0 1px rgba(var(--hud-line), 0.6);
  }
  .modal :global(header button:hover:not(:disabled)) {
    background: rgba(var(--hud-line), 0.24);
  }
  .modal :global(.text) {
    scrollbar-color: rgba(var(--hud-line), 0.4) transparent;
  }
  .modal :global(.verse.sel) {
    box-shadow: inset 2px 0 0 rgb(var(--hud-line));
  }
</style>
