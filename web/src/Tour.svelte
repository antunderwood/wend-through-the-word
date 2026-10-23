<script lang="ts">
  // The tour box: the offer on a first visit, then one step at a time, then the end. A ring marks the
  // step's target and the box never covers it, nor the node the step asks for (decisions 155 and 187).
  // Props only; App saves and restores the reader's state.
  import { untrack } from "svelte";
  import { screen } from "./screen.svelte";
  import { apart, makeRoom, spotFor, STEPS, tallest, type At, type TourPage } from "./tour";

  let { offer, page, onstart, onend }: { offer: boolean; page: TourPage; onstart: () => void; onend: (keep: boolean) => void } = $props();
  let i = $state(0);
  const step = $derived(STEPS[i]); // none at the end
  let box: HTMLElement, ring: HTMLElement;
  const begin = (): At => ({ model: page.model, notes: page.notes, moved: false });
  let at = untrack(begin);
  let target: Element | null | undefined;

  // Each frame: the step's check, then the ring and the box follow its target, as panels redraw and
  // names in the scene move. A pan the camera made for a step is undone when the step ends, or the
  // tour (decision 188).
  $effect(() => {
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!offer && step?.check(page, at)) {
        page.panBack();
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

  // A node in the scene as the reader sees it: its disc, which is what the reader taps, and its name
  // when shown (a crowded name is hidden, decision 124). Null when the node is not drawn.
  function nodeBox(id: string) {
    const d = page.nodeRect(id),
      name = document.querySelector(`[data-tour="scene"] [data-node="${id}"]`);
    if (!d || !name?.checkVisibility({ visibilityProperty: true })) return d;
    const r = name.getBoundingClientRect(),
      left = Math.min(r.left, d.left),
      top = Math.min(r.top, d.top);
    return new DOMRect(left, top, Math.max(r.right, d.right) - left, Math.max(r.bottom, d.bottom) - top);
  }
  // What the ring goes round and the box keeps clear of: the target's box, or for a name in the
  // scene, its node (decision 187).
  function marked(el: Element) {
    const id = el.getAttribute("data-node");
    return (id && el.closest('[data-tour="scene"]') && nodeBox(id)) || el.getBoundingClientRect();
  }

  // The step's node as last placed, to tell when the scene has settled, and whether the camera has
  // zoomed out for it in this step: once at most.
  let last: DOMRect | null = null,
    zoomed: unknown;

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
    const r = el && marked(el);
    const seen = r && r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    ring.hidden = !seen;
    const w = box.offsetWidth,
      m = 14;
    // On a phone the box stays above the bottom sheet, or left of it at the side, open or closed.
    const sheet = document.querySelector('[data-tour="sheet"]')?.getBoundingClientRect(),
      floor = sheet && !screen.side ? sheet.top : innerHeight,
      wall = sheet && screen.side ? sheet.left : innerWidth;
    const area = { left: 8, top: 8, right: wall - 8, bottom: floor - 8 };
    // The Recentre button is never covered (decision 188), nor on a phone the open search panel,
    // whose results the reader taps. The box is never taller than the room clear of them, its text
    // scrolling when the room is short (a short screen, or wide letters).
    const recentre = document.querySelector('[data-tour="recentre"]')?.getBoundingClientRect(),
      search = screen.phone ? document.querySelector('div[data-tour="search"]')?.getBoundingClientRect() : undefined,
      fixed = [recentre, search].filter((k): k is DOMRect => !!k?.width);
    box.style.maxHeight = `${Math.max(120, tallest(w, fixed, area, m))}px`;
    const h = box.offsetHeight,
      size = { w, h };
    // The step's node, when drawn where the reader can reach it: in the scene, in the space the sheet
    // leaves. The box keeps clear of it as well as of the target (decision 187). On a phone the hint
    // and the notes lie over the bottom of the scene: a node under them is panned out (reach).
    const id = offer ? undefined : step?.node?.(page),
      s = document.querySelector('[data-tour="scene"]')!.getBoundingClientRect(),
      scene = { left: Math.max(s.left, area.left), top: Math.max(s.top, area.top), right: Math.min(s.right, area.right), bottom: Math.min(s.bottom, area.bottom) },
      dock = screen.phone ? document.querySelector('[data-tour="dock"]')?.getBoundingClientRect() : undefined,
      reach = dock?.height ? { ...scene, bottom: Math.min(scene.bottom, dock.top - m) } : scene,
      n = id ? nodeBox(id) : null,
      [nx, ny] = n ? [n.left + n.width / 2, n.top + n.height / 2] : [NaN, NaN],
      node = n && nx > scene.left && nx < scene.right && ny > scene.top && ny < scene.bottom ? n : null,
      under = !!node && ny > reach.bottom,
      others = [...(r && seen && !(node && el?.getAttribute("data-node") === id) ? [r] : []), ...fixed],
      keep = node ? [node, ...others] : others;
    const settled = !!node && !!last && ["left", "top", "right", "bottom"].every((k) => Math.abs(node[k as "left"] - last![k as "left"]) < 0.5);
    last = node;
    if (seen) Object.assign(ring.style, { left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
    // The first place clear of the target and the node: beside either, then at the edges. With none,
    // once the scene has settled and the reader is not moving the camera, the box takes the place
    // that leaves the largest room in the scene and the camera pans the node into it, zooming out a
    // little (once a step) when the node does not fit. Until then, or with no node, the place that
    // covers least of them. With no target, the bottom left corner, unless the Recentre button or the
    // search panel is there.
    let [x, y] = [Math.min(16, wall - w - 8), Math.min(innerHeight - h - 92, floor - h - 8)];
    const clearOfFixed = ([a, b]: number[]) => fixed.every((k) => apart({ left: a, top: b, right: a + w, bottom: b + h }, k, m));
    if (keep.length > fixed.length || !clearOfFixed([x, y])) {
      const spot = under ? undefined : spotFor(size, keep, area, m),
        made = !spot && node && settled && !down ? makeRoom(size, node, others, area, reach, m) : undefined;
      if (spot) [x, y] = spot;
      else if (made) {
        const { room } = made,
          d = page.nodeRect(id!)!,
          small = node!.width + 2 * m > room.right - room.left || node!.height + 2 * m > room.bottom - room.top;
        const zoomOut = small && zoomed !== step ? 1.25 : 1;
        if (small) zoomed = step;
        page.panTo(id!, d.left + d.width / 2 + (room.left + room.right) / 2 - nx, d.top + d.height / 2 + (room.top + room.bottom) / 2 - ny, zoomOut);
        [x, y] = made.spot;
      } else {
        const onto = ([a, b]: number[]) => [Math.max(area.left, Math.min(area.right - w, a)), Math.max(area.top, Math.min(area.bottom - h, b))];
        const covered = ([a, b]: number[]) =>
          keep.reduce((sum, k) => sum + Math.max(0, Math.min(a + w, k.right) - Math.max(a, k.left)) * Math.max(0, Math.min(b + h, k.bottom) - Math.max(b, k.top)), 0);
        const tried = keep.flatMap((k) => [[k.left, k.bottom + m], [k.left, k.top - m - h], [k.left - m - w, k.top], [k.right + m, k.top]]).concat([[x, y]]).map(onto);
        // A place clear of the Recentre button and search first, when there is one.
        const clear = tried.filter(clearOfFixed);
        [x, y] = (clear.length ? clear : tried).reduce((best, s) => (covered(s) < covered(best) ? s : best));
      }
    }
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  }

  // The camera step: a drag of more than 5 px or a wheel on the scene. Names in the scene stop
  // pointerdown, so a click on one is not a drag.
  let down: { x: number; y: number } | undefined;
  const onScene = (e: Event) => !!(e.target as Element).closest?.('[data-tour="scene"]');

  function end(keep: boolean) {
    page.panBack();
    onend(keep);
  }
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
  <!-- The words, which scroll when the box is held shorter than they need, then the buttons. -->
  {#if offer}
    <div class="words">
      <h2>Welcome</h2>
      <p>New here? A short tour walks you through studying Jesus Christ: search, select, move the Focus, pin, read, and take notes. Each step waits for you, or does it for you.</p>
    </div>
    <div>
      <button onclick={onstart}>Take the tour</button>
      <button onclick={() => onend(false)}>Skip</button>
    </div>
  {:else if step}
    <div class="words" aria-live="polite">
      <p class="muted">Step {i + 1} of {STEPS.length}</p>
      <h2>{step.title}</h2>
      <p>{step.text(page)}</p>
    </div>
    <div>
      <button onclick={() => step.act(page)}>Do it for me</button>
      <button onclick={() => end(false)}>End tour</button>
    </div>
  {:else}
    <div class="words" aria-live="polite">
      <h2>Done</h2>
      <p>That is the student journey. Your Focus, Your Path, pins, and filters now go back as they were, and the note you wrote is removed unless you keep it. "Help: take the tour" at the bottom runs it again.</p>
    </div>
    <div>
      <button onclick={() => end(false)}>Finish</button>
      <button onclick={() => end(true)}>Finish and keep my note</button>
    </div>
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
    display: flex;
    flex-direction: column;
  }
  .words {
    min-height: 0;
    overflow-y: auto;
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
