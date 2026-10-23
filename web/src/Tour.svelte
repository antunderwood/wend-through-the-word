<script lang="ts">
  // The tour box: the offer on a first visit, then one step at a time, then the end. A ring marks the
  // step's target and the box never covers it (decision 155). Props only; App saves and restores the
  // reader's state.
  import { untrack } from "svelte";
  import { screen } from "./screen.svelte";
  import { STEPS, type At, type TourPage } from "./tour";

  let { offer, page, onstart, onend }: { offer: boolean; page: TourPage; onstart: () => void; onend: (keep: boolean) => void } = $props();
  let i = $state(0);
  const step = $derived(STEPS[i]); // none at the end
  let box: HTMLElement, ring: HTMLElement;
  const begin = (): At => ({ model: page.model, notes: page.notes, moved: false });
  let at = untrack(begin);
  let target: Element | null | undefined;

  // Each frame: the step's check, then the ring and the box follow its target, as panels redraw and
  // names in the scene move.
  $effect(() => {
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!offer && step?.check(page, at)) {
        i++;
        at = begin();
      }
      place(offer ? null : step?.target(page));
    });
    return () => cancelAnimationFrame(raf);
  });

  // On a phone, before a step shows its target, the sheet is set as the target needs, as taps on its
  // handle and tabs would (decision 185): a target in the sheet opens it at the target's tab, and a
  // target in the scene closes it, so neither the sheet nor the box is in the scene's way. Anything
  // else (the top bar) leaves it as it is, and so does a change the reader makes during the step.
  // True when it changed the sheet: the target is placed on a later frame, once the sheet shows it.
  function arrange(el: Element) {
    const sheet = document.querySelector('[data-tour="sheet"]');
    if (!sheet) return false;
    const handle = sheet.querySelector<HTMLElement>('[aria-controls="sheet-body"]')!;
    const open = handle.getAttribute("aria-expanded") === "true";
    if (sheet.contains(el) ? !open : open && el.closest('[data-tour="scene"]')) {
      handle.click();
      return true;
    }
    const tab = el.closest("[role=tabpanel][hidden]");
    if (tab) document.getElementById(tab.getAttribute("aria-labelledby")!)!.click();
    return !!tab;
  }

  function place(el: Element | null | undefined) {
    if (el && el !== target && arrange(el)) return;
    // A target in the panel is scrolled into its view once; scene names are never scrolled. Any other
    // target brings the panel back to its top, where the Selected Node is. A target taller than half
    // the panel (a long list) is scrolled to its start, as "nearest" would leave it where it is when
    // it overflows both edges; the panel's scroll padding keeps it below the actions held at its top.
    const panel = el && el !== target && el.closest("#panel");
    if (panel) el.scrollIntoView({ block: el.getBoundingClientRect().height > panel.clientHeight / 2 ? "start" : "nearest" });
    else if (el !== target) document.getElementById("panel")?.scrollTo(0, 0);
    target = el;
    const r = el?.getBoundingClientRect();
    const seen = r && r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    ring.hidden = !seen;
    const w = box.offsetWidth,
      h = box.offsetHeight,
      m = 14;
    // On a phone the box stays above the bottom sheet, or left of it at the side, open or closed.
    const sheet = document.querySelector('[data-tour="sheet"]')?.getBoundingClientRect(),
      floor = sheet && !screen.side ? sheet.top : innerHeight,
      wall = sheet && screen.side ? sheet.left : innerWidth;
    // Below, above, left of, or right of the target, whichever fits; on a phone also at the edges of
    // the space the sheet leaves, if clear of the target. Where none fits, the spot moved onto the
    // screen that covers least of the target. With no target, the bottom left corner.
    let [x, y] = [Math.min(16, wall - w - 8), Math.min(innerHeight - h - 92, floor - h - 8)];
    if (seen) {
      Object.assign(ring.style, { left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
      const cx = Math.max(8, Math.min(wall - w - 8, r.left)),
        cy = Math.max(8, Math.min(floor - h - 8, r.top));
      const spots = [[cx, r.bottom + m], [cx, r.top - m - h], [r.left - m - w, cy], [r.right + m, cy]];
      if (sheet) spots.push([cx, floor - h - 8], [cx, 8], [8, cy], [wall - w - 8, cy]);
      const clear = ([a, b]: number[]) => a + w + m <= r.left || r.right + m <= a || b + h + m <= r.top || r.bottom + m <= b;
      const fits = ([a, b]: number[]) => a >= 8 && b >= 8 && a + w <= wall - 8 && b + h <= floor - 8;
      const onto = ([a, b]: number[]) => [Math.max(8, Math.min(wall - w - 8, a)), Math.max(8, Math.min(floor - h - 8, b))];
      const covered = ([a, b]: number[]) =>
        Math.max(0, Math.min(a + w, r.right) - Math.max(a, r.left)) * Math.max(0, Math.min(b + h, r.bottom) - Math.max(b, r.top));
      const fallback = [...spots, [x, y]].map(onto).reduce((best, s) => (covered(s) < covered(best) ? s : best));
      [x, y] = spots.find((s) => fits(s) && clear(s)) ?? fallback;
    }
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  }

  // The camera step: a drag of more than 5 px or a wheel on the scene. Names in the scene stop
  // pointerdown, so a click on one is not a drag.
  let down: { x: number; y: number } | undefined;
  const onScene = (e: Event) => !!(e.target as Element).closest?.('[data-tour="scene"]');
</script>

<svelte:window
  onpointerdown={(e) => (down = onScene(e) ? { x: e.clientX, y: e.clientY } : undefined)}
  onpointermove={(e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) at.moved = true;
  }}
  onpointerup={() => (down = undefined)}
  onwheel={(e) => onScene(e) && (at.moved = true)}
/>
<div class="tour-target" hidden bind:this={ring}></div>
<div class="tour" role="dialog" aria-label="Tour" bind:this={box}>
  {#if offer}
    <h2>Welcome</h2>
    <p>New here? A short tour walks you through studying Jesus Christ: search, select, move the Focus, pin, read, and take notes. Each step waits for you, or does it for you.</p>
    <button onclick={onstart}>Take the tour</button>
    <button onclick={() => onend(false)}>Skip</button>
  {:else if step}
    <div aria-live="polite">
      <p class="muted">Step {i + 1} of {STEPS.length}</p>
      <h2>{step.title}</h2>
      <p>{step.text(page)}</p>
    </div>
    <button onclick={() => step.act(page)}>Do it for me</button>
    <button onclick={() => onend(false)}>End tour</button>
  {:else}
    <div aria-live="polite">
      <h2>Done</h2>
      <p>That is the student journey. Your Focus, Your Path, pins, and filters now go back as they were, and the note you wrote is removed unless you keep it. "Help: take the tour" at the bottom runs it again.</p>
    </div>
    <button onclick={() => onend(false)}>Finish</button>
    <button onclick={() => onend(true)}>Finish and keep my note</button>
  {/if}
</div>

<style>
  /* A still ring, so reduced motion has nothing to stop. */
  .tour-target {
    position: fixed;
    z-index: 10;
    pointer-events: none;
    border: 2px solid #ffd27a;
    border-radius: 8px;
    box-shadow: 0 0 0 4px rgba(255, 210, 122, 0.3);
  }
  .tour {
    position: fixed;
    z-index: 11;
    width: 300px;
    box-sizing: border-box;
    padding: 10px 12px;
    background: #1b1f2e;
    border: 1px solid #ffd27a;
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
    font-size: 13px;
  }
  /* On a phone the box is as wide as the screen, so it is short enough to fit above the sheet. */
  :global(html[data-phone]) .tour {
    width: calc(100vw - 16px);
  }
  /* At the side, it fits beside a name in the scene, left of the sheet. */
  :global(html[data-side]) .tour {
    width: min(280px, calc(100vw - var(--sheet-covered) - 16px));
  }
  :global(html[data-phone]) .tour button {
    min-height: 44px;
  }
  h2 {
    margin: 4px 0;
    font-size: 15px;
    color: #ffd27a;
  }
  p {
    margin: 4px 0 8px;
  }
  .muted {
    margin: 0;
    font-size: 12px;
    color: #9aa0b4;
  }
  button {
    font: inherit;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
    padding: 3px 10px;
    cursor: pointer;
  }
</style>
