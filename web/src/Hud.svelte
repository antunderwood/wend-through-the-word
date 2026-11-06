<script lang="ts">
  // The HUD: the Selected Node at a glance, on a see-through card over the scene with a leader line
  // to its node. A desktop window's alternative to the detail panel (InfoMode "hud"); the panel stays
  // one click away for the lists, notes, and corrections. Props only; App owns the state.
  import { typeColour } from "./colours";
  import type { Data } from "./data";
  import { chamfer, clipPath, linkCounts, segments, shortList, svgPoints } from "./hud";
  import { relation, typeOf, TYPE_NAME, typePlural, type Action, type Id, type NodeType, type State } from "./model";

  let {
    data,
    model,
    label,
    apply,
    makeFocus,
    pin,
    onread,
    onpanel,
    nodeRect,
    motion,
  }: {
    data: Data;
    model: State;
    label: (id: Id) => string;
    apply: (a: Action) => void;
    makeFocus: (id: Id) => void;
    pin: (id: Id) => void;
    onread: () => void;
    onpanel: () => void; // back to the side panel
    nodeRect?: (id: Id) => DOMRect | null; // where the Selected Node is drawn, for the leader line
    motion: boolean;
  } = $props();

  const CUT = 18; // the cut corners, px
  const SEGMENTS = 12; // per readout bar

  const selected = $derived(model.selected);
  const focus = $derived(model.focus);
  const kind = $derived(typeOf(selected));
  const overflow = $derived(kind === "overflow");
  const isEntity = $derived(!["verse", "overflow"].includes(kind));
  const typeName = $derived(overflow ? "Overflow" : TYPE_NAME[kind as NodeType]);
  const colour = $derived(overflow ? "#a9b1c6" : typeColour(kind as NodeType));
  const plainName = (id: Id) => data.label(id, false).replace(/\s*\(.*\)$/, "");

  // The Relationship, read from the Focus as the panel reads it.
  const link = $derived(selected === focus ? undefined : data.record(focus)?.links.find((l) => l.id === selected));
  const linkWords = $derived(link && relation(link, data.genderOf, plainName(focus)).text);

  const details = $derived(isEntity ? data.details(selected) : undefined);
  const verseText = $derived(kind === "verse" && !data.outside(selected) ? data.load(selected).then((r) => r.text) : undefined);
  const counts = $derived(overflow || data.outside(selected) ? undefined : data.load(selected).then((r) => linkCounts(r.links)));

  // The card's size, for its cut outline.
  let w = $state(0);
  let h = $state(0);
  const outline = $derived(chamfer(w, h, CUT, 0.5));

  // The leader line from the card's left edge to the Selected Node, and the brackets round the node,
  // followed every frame while the HUD shows (the camera glides and the reader orbits it).
  let card = $state<HTMLElement>();
  let lead = $state<{ points: string; x: number; y: number; r: number } | null>(null);
  $effect(() => {
    const id = selected;
    if (!nodeRect || !card) return;
    let frame = requestAnimationFrame(follow);
    function follow() {
      const n = nodeRect!(id),
        c = card!.getBoundingClientRect();
      if (!n || n.width === 0 || n.right + 12 > c.left) lead = null;
      else {
        const x = n.left + n.width / 2,
          y = n.top + n.height / 2,
          r = n.width / 2 + 6,
          at = Math.min(Math.max(y, c.top + 28), c.bottom - 28), // where the line meets the card
          bend = c.left - 28;
        const points = `${x + r},${y} ${Math.max(x + r, bend - Math.abs(at - y) * 0.4)},${y} ${bend},${at} ${c.left},${at}`;
        if (points !== lead?.points) lead = { points, x, y, r };
      }
      frame = requestAnimationFrame(follow);
    }
    return () => cancelAnimationFrame(frame);
  });
  // The four corner brackets round the node.
  const brackets = (x: number, y: number, r: number) => {
    const s = Math.max(4, r * 0.45);
    return [
      `M${x - r},${y - r + s}V${y - r}H${x - r + s}`,
      `M${x + r - s},${y - r}H${x + r}V${y - r + s}`,
      `M${x + r},${y + r - s}V${y + r}H${x + r - s}`,
      `M${x - r + s},${y + r}H${x - r}V${y + r - s}`,
    ].join("");
  };
</script>

{#if lead}
  <svg class="lead" aria-hidden="true">
    <path d={brackets(lead.x, lead.y, lead.r)} />
    <polyline points={lead.points} />
    <circle cx={lead.x + lead.r} cy={lead.y} r="2" />
  </svg>
{/if}
<section class="hud" class:still={!motion} aria-label="Selected Node HUD" bind:this={card} bind:clientWidth={w} bind:clientHeight={h} style:--type={colour}>
  <div class="glass" style:clip-path={clipPath(outline)}></div>
  <svg class="frame" aria-hidden="true">
    <polygon points={svgPoints(outline)} />
    <path d="M{CUT + 10},4.5H{CUT + 70}M{w - 64},{h - 4.5}H{w - CUT - 10}" />
  </svg>
  <header class="strip">
    <span class="tag"><i aria-hidden="true"></i>{typeName}</span>
    {#if selected === focus}<span class="badge">Focus</span>{:else if model.pins.includes(selected)}<span class="badge">Pinned</span>{/if}
    <span class="ticks" aria-hidden="true"><b></b><b></b><b></b></span>
  </header>
  {#key selected}
    <div class="body">
      <h2 class="name" title={label(selected)}>{label(selected)}</h2>
      {#if linkWords}<p class="rel"><span class="key">Rel</span> {linkWords} <span class="dim">/ {plainName(focus)}</span></p>{/if}
      {#if data.outside(selected)}<p class="dim">{data.outside(selected)}</p>{/if}

      {#if verseText}
        {#await verseText then t}{#if t}<blockquote class="text">{t}</blockquote>{/if}{/await}
      {/if}

      {#await details then d}
        {#if d?.facts.length}
          <h3>Data</h3>
          <dl class="facts">
            {#each d.facts as f (f.name)}
              <dt>{f.name}</dt>
              <dd title={f.value}>{f.name === "Also called" || f.name === "Other names" ? shortList(f.value) : f.value}</dd>
            {/each}
          </dl>
        {/if}
        {#if d?.entry}
          <h3 title={d.entry.licence}>{d.entry.source}</h3>
          <p class="text entry">{d.entry.text.split(/\n\s*\n\s*/)[0]}</p>
        {/if}
      {:catch}
        <p class="dim">Could not load the details.</p>
      {/await}

      {#await counts then list}
        {#if list?.length}
          {@const largest = Math.max(...list.map((c) => c.count))}
          <h3>Links</h3>
          <ul class="bars">
            {#each list as c (c.type)}
              <li style:--c={typeColour(c.type)}>
                <span class="what">{typePlural(c.type)}</span>
                <span class="bar" aria-hidden="true">
                  {#each { length: SEGMENTS } as _, i (i)}<b class:on={i < segments(c.count, largest, SEGMENTS)}></b>{/each}
                </span>
                <span class="n">{c.count}</span>
              </li>
            {/each}
          </ul>
        {/if}
      {:catch}
        <p class="dim">Could not load the links.</p>
      {/await}
    </div>
  {/key}
  <footer class="actions">
    <!-- The Focus already has its badge in the strip, so its card offers no Make Focus. -->
    {#if selected !== focus}<button class="primary" onclick={() => makeFocus(selected)} disabled={overflow}>Make Focus</button>{/if}
    {#if model.pins.includes(selected)}
      <button onclick={() => apply({ type: "unpin", id: selected })}>Unpin</button>
    {:else}
      <button onclick={() => pin(selected)}>Pin</button>
    {/if}
    <button onclick={onread} disabled={overflow}>Read</button>
    <button class="more" onclick={onpanel} title="Show the full detail panel: lists, notes, and corrections">Details</button>
  </footer>
</section>

<style>
  /* The HUD's own palette: a cold cyan line on dark glass, so the scene shows through. */
  .hud {
    --line: 127, 227, 255;
    --ink: #e8fbff;
    --mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    position: fixed;
    top: 72px;
    right: 16px;
    width: 340px;
    max-height: calc(100dvh - 72px - 96px); /* clear of the view picker and the footer */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 10px 16px 14px;
    color: var(--ink);
    isolation: isolate;
  }
  .glass,
  .frame {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  /* Semi-transparent: a light tint and a slight blur, so the graph stays visible behind the card but
     its labels do not fight the text. Scan lines give it the look of a projected panel. */
  .glass {
    background:
      repeating-linear-gradient(0deg, rgba(var(--line), 0.035) 0 1px, transparent 1px 3px),
      linear-gradient(160deg, rgba(var(--line), 0.14), rgba(10, 22, 38, 0.42) 40%, rgba(10, 22, 38, 0.5));
    backdrop-filter: blur(3px) saturate(1.2);
    -webkit-backdrop-filter: blur(3px) saturate(1.2);
  }
  .frame {
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 0 3px rgba(var(--line), 0.7));
  }
  .frame polygon {
    fill: none;
    stroke: rgba(var(--line), 0.75);
    stroke-width: 1;
  }
  .frame path {
    stroke: rgba(var(--line), 0.95);
    stroke-width: 3;
  }

  .strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 8px 14px;
    border-bottom: 1px solid rgba(var(--line), 0.3);
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--type);
  }
  .tag i {
    width: 8px;
    height: 8px;
    background: var(--type);
    box-shadow: 0 0 6px var(--type);
    transform: rotate(45deg);
  }
  .badge {
    padding: 2px 6px;
    border: 1px solid rgba(var(--line), 0.6);
    color: rgb(var(--line));
  }
  .ticks {
    margin-left: auto;
    display: flex;
    gap: 3px;
  }
  .ticks b {
    width: 10px;
    height: 4px;
    background: rgba(var(--line), 0.8);
    transform: skewX(-30deg);
  }
  .ticks b:last-child {
    background: rgba(var(--line), 0.25);
  }

  .body {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--line), 0.4) transparent;
    animation: scan 0.22s ease-out;
  }
  .still .body {
    animation: none;
  }
  @keyframes scan {
    from {
      opacity: 0;
      clip-path: inset(0 0 100% 0);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .body {
      animation: none;
    }
  }
  .name {
    margin: 10px 0 2px;
    font-size: 22px;
    line-height: 1.15;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(var(--line), 0.45);
    overflow-wrap: anywhere;
  }
  .name::after {
    content: "";
    display: block;
    width: 48px;
    height: 2px;
    margin-top: 6px;
    background: var(--type);
    box-shadow: 0 0 6px var(--type);
  }
  .rel {
    margin: 6px 0 0;
    font: 12px/1.4 var(--mono);
  }
  .key {
    color: rgb(var(--line));
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-size: 10px;
  }
  .dim {
    color: rgba(232, 251, 255, 0.6);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 6px;
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgb(var(--line));
  }
  h3::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(var(--line), 0.5), transparent);
  }
  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    margin: 0;
    font: 12px/1.4 var(--mono);
  }
  .facts dt {
    color: rgba(232, 251, 255, 0.6);
  }
  .facts dd {
    margin: 0;
  }
  .text {
    margin: 8px 0 0;
    padding-left: 10px;
    border-left: 2px solid rgba(var(--line), 0.6);
    font-size: 13px;
    line-height: 1.5;
  }
  .entry {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 7;
    line-clamp: 7;
    overflow: hidden;
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    font: 11px/1 var(--mono);
  }
  .bars li {
    display: grid;
    grid-template-columns: 108px 1fr 28px;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .what {
    white-space: nowrap;
    color: var(--c);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .bar {
    display: flex;
    gap: 2px;
  }
  .bar b {
    flex: 1;
    height: 8px;
    background: rgba(var(--line), 0.1);
    transform: skewX(-20deg);
  }
  .bar b.on {
    background: var(--c);
    box-shadow: 0 0 4px var(--c);
  }
  .n {
    text-align: right;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(var(--line), 0.3);
  }
  /* Buttons with a cut corner, outlined in the HUD's line. */
  .actions button {
    padding: 6px 10px;
    border: 0;
    border-radius: 0;
    background: rgba(var(--line), 0.08);
    box-shadow: inset 0 0 0 1px rgba(var(--line), 0.55);
    color: var(--ink);
    font: 600 11px/1 var(--mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
    cursor: pointer;
  }
  .actions button:hover:not(:disabled) {
    background: rgba(var(--line), 0.22);
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .actions .primary {
    background: rgba(var(--line), 0.28);
    box-shadow: inset 0 0 0 1px rgb(var(--line));
  }
  .actions .more {
    margin-left: auto;
  }

  /* Above the scene, below the HUD; a click goes through to the scene. */
  .lead {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    fill: none;
    stroke: rgba(127, 227, 255, 0.8);
    stroke-width: 1.25;
    filter: drop-shadow(0 0 2px rgba(127, 227, 255, 0.8));
  }
  .lead circle {
    fill: rgb(127, 227, 255);
  }
</style>
