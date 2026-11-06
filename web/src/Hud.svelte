<script lang="ts">
  // The HUD: the Selected Node on a see-through card over the scene, with a leader line to its node.
  // A desktop window's alternative to the detail panel (InfoMode "hud"). Its tabs hold the overview,
  // the Neighbour lists, the Verses shared with the Focus, and the journey note; the panel stays one
  // click away for corrections, the map, and the pins' lists. The reader drags the card by its strip
  // and sizes it by its corner; both are kept in this browser. Props only; App owns the state.
  import { untrack } from "svelte";
  import VerseText from "./VerseText.svelte";
  import { typeColour } from "./colours";
  import type { Data } from "./data";
  import {
    chamfer,
    clampPlace,
    clipPath,
    HUD_W,
    keepFlicker,
    keepPlace,
    keptFlicker,
    keptPlace,
    leadRoute,
    linkCounts,
    segments,
    shortList,
    svgPoints,
    type HudPlace,
  } from "./hud";
  import { fold, passing, relation, relationWords, typeOf, TYPES, TYPE_NAME, typePlural, type Action, type Id, type NodeType, type State } from "./model";
  import type { Notes } from "./session";

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
    notes,
    onnote,
    download,
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
    notes: Notes;
    onnote: (id: Id, text: string) => void;
    download: () => void;
  } = $props();

  const CUT = 18; // the cut corners, px
  const SEGMENTS = 12; // per readout bar
  const SHOWN = 6; // rows per type in Links before "+N more"
  const PAGE = 100; // rows per type once opened
  const TOGETHER = 20; // shared Verses before "more"

  const selected = $derived(model.selected);
  const focus = $derived(model.focus);
  const kind = $derived(typeOf(selected));
  const overflow = $derived(kind === "overflow");
  const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));
  const typeName = $derived(overflow ? "Overflow" : TYPE_NAME[kind as NodeType]);
  const colour = $derived(overflow ? "#a9b1c6" : typeColour(kind as NodeType));
  const plainName = (id: Id) => data.label(id, false).replace(/\s*\(.*\)$/, "");

  // The Relationship, read from the Focus as the panel reads it.
  const link = $derived(selected === focus ? undefined : data.record(focus)?.links.find((l) => l.id === selected));
  const linkWords = $derived(link && relation(link, data.genderOf, plainName(focus)).text);

  const details = $derived(isEntity(selected) ? data.details(selected) : undefined);
  const verseText = $derived(kind === "verse" && !data.outside(selected) ? data.load(selected).then((r) => r.text) : undefined);
  const counts = $derived(overflow || data.outside(selected) ? undefined : data.load(selected).then((r) => linkCounts(r.links)));

  // An Overflow Node lists the Focus's Neighbours of its type, as in the panel.
  const listing = $derived.by(() => {
    if (data.outside(selected)) return undefined;
    return overflow
      ? data.loadWithKin(focus).then((r) => ({ r, types: [selected.slice("overflow:".length) as NodeType] }))
      : data.loadWithKin(selected).then((r) => ({ r, types: [...TYPES] }));
  });
  const shared = $derived(
    selected !== focus && isEntity(selected) && isEntity(focus)
      ? data.shared(focus, selected).then((verses) => ({ verses, names: [selected, focus].flatMap((id) => data.named(id) ?? []) }))
      : undefined,
  );
  const noted = $derived(selected === focus || model.path.includes(selected));

  // The tabs this node has; a tab the next node lacks falls back to the overview.
  type Tab = "overview" | "links" | "together" | "note";
  let tab = $state<Tab>("overview");
  const tabs = $derived<{ id: Tab; name: string }[]>([
    { id: "overview", name: "Overview" },
    ...(listing ? [{ id: "links" as Tab, name: "Links" }] : []),
    ...(shared ? [{ id: "together" as Tab, name: "Together" }] : []),
    ...(noted ? [{ id: "note" as Tab, name: "Note" }] : []),
  ]);
  const shownTab = $derived(tabs.some((t) => t.id === tab) ? tab : "overview");
  function tabKey(e: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    const i = tabs.findIndex((t) => t.id === shownTab);
    tab = tabs[(i + step + tabs.length) % tabs.length].id;
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();
    e.preventDefault();
  }

  // Links: one query over every type's list; a type opened past its first rows.
  let query = $state("");
  let opened = $state<Record<string, boolean>>({});
  let entryOpen = $state(false);
  let togetherAll = $state(false);
  // A new node starts its lists closed and the entry short; the query lasts while the Focus does.
  let lastSelected = "";
  let lastFocus = "";
  $effect.pre(() => {
    if (selected !== lastSelected) [opened, entryOpen, togetherAll, lastSelected] = [{}, false, false, selected];
    if (focus !== lastFocus) [query, lastFocus] = ["", focus];
  });

  // Where the card is and how big: the kept place, or the default spot top right.
  let place = $state<HudPlace | null>(keptPlace());
  let flicker = $state(keptFlicker());
  function fit() {
    if (place) place = clampPlace(place, innerWidth, innerHeight);
  }
  $effect(() => {
    untrack(fit);
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  });
  function here(): HudPlace {
    const r = card!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: place?.h };
  }
  // A drag on the strip moves the card; on the corner grip it sizes it. Arrow keys on either grip do
  // the same by 16 px (with Shift, 64).
  function drag(e: PointerEvent, sizing: boolean) {
    if (e.button !== 0 || (!sizing && (e.target as Element).closest("button:not(.grip), [role=tab]"))) return;
    const start = here(),
      r = card!.getBoundingClientRect(),
      from = { x: e.clientX, y: e.clientY },
      el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      const dx = m.clientX - from.x,
        dy = m.clientY - from.y;
      place = clampPlace(sizing ? { ...start, w: start.w + dx, h: (start.h ?? r.height) + dy } : { ...start, x: start.x + dx, y: start.y + dy }, innerWidth, innerHeight);
    };
    const end = () => {
      el.removeEventListener("pointermove", move);
      if (place) keepPlace(place);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end, { once: true });
    el.addEventListener("pointercancel", end, { once: true });
    e.preventDefault();
  }
  function nudge(e: KeyboardEvent, sizing: boolean) {
    const by = e.shiftKey ? 64 : 16;
    const d = { ArrowLeft: [-by, 0], ArrowRight: [by, 0], ArrowUp: [0, -by], ArrowDown: [0, by] }[e.key];
    if (!d) return;
    const p = here();
    place = clampPlace(sizing ? { ...p, w: p.w + d[0], h: (p.h ?? card!.offsetHeight) + d[1] } : { ...p, x: p.x + d[0], y: p.y + d[1] }, innerWidth, innerHeight);
    keepPlace(place);
    e.preventDefault();
  }
  function reset() {
    place = null;
    keepPlace(null);
  }
  function setFlicker(on: boolean) {
    flicker = on;
    keepFlicker(on);
  }

  // The card's size, for its cut outline.
  let w = $state(0);
  let h = $state(0);
  const outline = $derived(chamfer(w, h, CUT, 0.5));

  // The leader line from the card's nearer side to the Selected Node, and the brackets round the
  // node, followed every frame while the HUD shows (the camera glides and the reader orbits it). It
  // goes round the Focus (leadRoute) and fades from the card towards the node, so it points the way
  // without drawing over the picture; the brackets mark the node itself.
  let card = $state<HTMLElement>();
  let lead = $state<{ points: string; x: number; y: number; r: number; from: number[]; to: number[] } | null>(null);
  const disc = (d: DOMRect) => ({ x: d.left + d.width / 2, y: d.top + d.height / 2, r: d.width / 2 });
  $effect(() => {
    const id = selected,
      f = focus;
    if (!nodeRect || !card) return;
    let frame = requestAnimationFrame(follow);
    function follow() {
      const n = nodeRect!(id),
        fr = id === f ? null : nodeRect!(f),
        route = n && n.width ? leadRoute({ ...disc(n), r: disc(n).r + 6 }, card!.getBoundingClientRect(), fr && fr.width ? disc(fr) : undefined) : null;
      if (!route) lead = null;
      else {
        const points = route.map((p) => p.join(",")).join(" ");
        if (points !== lead?.points) lead = { points, ...disc(n!), r: disc(n!).r + 6, from: route.at(-1)!, to: route[0] };
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
    <defs>
      <linearGradient id="hud-lead" gradientUnits="userSpaceOnUse" x1={lead.from[0]} y1={lead.from[1]} x2={lead.to[0]} y2={lead.to[1]}>
        <stop offset="0" stop-color="rgb(127, 227, 255)" stop-opacity="0.55" />
        <stop offset="0.6" stop-color="rgb(127, 227, 255)" stop-opacity="0.18" />
        <stop offset="1" stop-color="rgb(127, 227, 255)" stop-opacity="0.08" />
      </linearGradient>
    </defs>
    <polyline points={lead.points} stroke="url(#hud-lead)" />
    <path class="brackets" d={brackets(lead.x, lead.y, lead.r)} />
  </svg>
{/if}
<section
  class="hud"
  class:still={!motion}
  class:flicker={flicker && motion}
  class:placed={!!place}
  aria-label="Selected Node HUD"
  bind:this={card}
  bind:clientWidth={w}
  bind:clientHeight={h}
  style:--type={colour}
  style:left={place ? `${place.x}px` : undefined}
  style:top={place ? `${place.y}px` : undefined}
  style:width="{place?.w ?? HUD_W}px"
  style:height={place?.h ? `${place.h}px` : undefined}
  style:max-height={place ? `calc(100dvh - ${place.y}px - 8px)` : undefined}
>
  <div class="glass" style:clip-path={clipPath(outline)}></div>
  <svg class="frame" aria-hidden="true">
    <polygon points={svgPoints(outline)} />
    <path d="M{CUT + 10},4.5H{CUT + 70}M{w - 64},{h - 4.5}H{w - CUT - 10}" />
  </svg>
  <!-- The strip is the handle: a drag on it moves the card. The Move HUD grip is its keyboard way. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="strip" onpointerdown={(e) => drag(e, false)}>
    <span class="tag"><i aria-hidden="true"></i>{typeName}</span>
    {#if selected === focus}<span class="badge">Focus</span>{:else if model.pins.includes(selected)}<span class="badge">Pinned</span>{/if}
    <span class="tools">
      <button class="tool" aria-pressed={flicker} aria-label="Flicker" title={motion ? "Flicker" : "Flicker (off while animation is off)"} onclick={() => setFlicker(!flicker)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9 1 3 9h4l-1 6 6-8H8z" /></svg>
      </button>
      {#if place}
        <button class="tool" aria-label="Reset HUD position" title="Back to the top right, at the first size" onclick={reset}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2v3h3" /></svg>
        </button>
      {/if}
      <button class="tool grip" aria-label="Move HUD" title="Drag to move; arrow keys move it too" onkeydown={(e) => nudge(e, false)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1v14M1 8h14M8 1 6 3M8 1l2 2M8 15l-2-2M8 15l2-2M1 8l2-2M1 8l2 2M15 8l-2-2M15 8l-2 2" /></svg>
      </button>
    </span>
  </header>
  {#key selected}
    <div class="head">
      <h2 class="name" title={label(selected)}>{label(selected)}</h2>
      {#if linkWords}<p class="rel"><span class="key">Rel</span> {linkWords} <span class="dim">/ {plainName(focus)}</span></p>{/if}
    </div>
  {/key}
  {#if tabs.length > 1}
    <div class="tabs" role="tablist" aria-label="HUD sections" tabindex="-1" onkeydown={tabKey}>
      {#each tabs as t (t.id)}
        <button role="tab" id="hud-tab-{t.id}" data-tab={t.id} aria-selected={shownTab === t.id} aria-controls="hud-body" tabindex={shownTab === t.id ? 0 : -1} onclick={() => (tab = t.id)}>{t.name}</button>
      {/each}
    </div>
  {/if}
  {#key `${selected}|${shownTab}`}
    <div class="body" id="hud-body" role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `hud-tab-${shownTab}` : undefined}>
      {#if shownTab === "overview"}{@render overviewTab()}{/if}
      {#if shownTab === "links"}{@render linksTab()}{/if}
      {#if shownTab === "together"}{@render togetherTab()}{/if}
      {#if shownTab === "note"}{@render noteTab()}{/if}
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
    <button class="more" onclick={onpanel} title="Show the full detail panel: map, pins, and corrections">Panel</button>
  </footer>
  <!-- The corner grip sizes the card. -->
  <button
    class="resize"
    aria-label="Resize HUD"
    title="Drag to resize; arrow keys resize it too"
    onpointerdown={(e) => drag(e, true)}
    onkeydown={(e) => nudge(e, true)}
  ></button>
</section>

{#snippet overviewTab()}
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
      {@const paragraphs = d.entry.text.split(/\n\s*\n\s*/)}
      <h3 title={d.entry.licence}>{d.entry.source}</h3>
      {#each entryOpen ? paragraphs : paragraphs.slice(0, 1) as p, i (i)}<p class="text entry" class:clamp={!entryOpen}>{p}</p>{/each}
      <button class="link" aria-expanded={entryOpen} onclick={() => (entryOpen = !entryOpen)}>{entryOpen ? "Read less" : "Read the whole entry"}</button>
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
{/snippet}

<!-- Every Neighbour by type, as the panel lists them, under the filters. A click selects, a double
     click makes the Focus. -->
{#snippet linksTab()}
  {#await listing}
    <p class="dim">Loading links…</p>
  {:then list}
    {#if list}
      <input class="query" type="search" placeholder="Filter links" aria-label="Filter links" autocomplete="off" bind:value={query} onkeydown={(e) => e.key === "Escape" && (query = "")} />
      {#each list.types as t (t)}
        {@const all = passing(list.r, t, model.filters, data.bookOf)}
        {@const q = fold(query)}
        {@const rows = q ? all.filter((l) => fold(data.label(l.id, false)).includes(q)) : all}
        {#if rows.length}
          <h3 id="hud-list-{t}" style:--c={typeColour(t)}><span class="dot"></span>{typePlural(t)} <span class="dim">{q ? `${rows.length} of ${all.length}` : all.length}</span></h3>
          <ul class="rows" aria-labelledby="hud-list-{t}">
            {#each rows.slice(0, opened[t] || q ? PAGE : SHOWN) as l (l.id)}
              {@const words = relationWords(list.r.type, l, data.genderOf, plainName(list.r.id)).text}
              <li>
                <button class="row" onclick={() => apply({ type: "select", id: l.id })} ondblclick={() => makeFocus(l.id)}>
                  <span class="who">{data.label(l.id, false)}</span>{#if words}{" "}<span class="dim why">{words}</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
          {#if !q && rows.length > SHOWN}
            <button class="link" aria-expanded={!!opened[t]} onclick={() => (opened[t] = !opened[t])}>
              {opened[t] ? "Fewer" : `+${rows.length - SHOWN} more`}
            </button>
          {/if}
          {#if rows.length > PAGE && (opened[t] || q)}<p class="dim small">The first {PAGE}; the panel pages through the rest.</p>{/if}
        {/if}
      {/each}
    {/if}
  {:catch e}
    <p class="dim">Could not load the links: {e.message}</p>
  {/await}
{/snippet}

<!-- The Verses the Selected Node shares with the Focus, names in bold and referring terms underlined
     in their type's colour. -->
{#snippet togetherTab()}
  {#await shared}
    <p class="dim">Loading verses…</p>
  {:then s}
    {#if s && s.verses.length}
      <h3>With {plainName(focus)} in {s.verses.length} verse{s.verses.length === 1 ? "" : "s"}</h3>
      <ul class="verses">
        {#each togetherAll ? s.verses : s.verses.slice(0, TOGETHER) as v (v.key)}
          <li>
            <button class="ref" onclick={() => apply({ type: "select", id: v.key })} ondblclick={() => makeFocus(v.key)}>{data.label(v.key)}</button>
            <p class="text"><VerseText text={v.text} names={s.names} terms={v.terms} /></p>
          </li>
        {/each}
      </ul>
      {#if s.verses.length > TOGETHER}
        <button class="link" aria-expanded={togetherAll} onclick={() => (togetherAll = !togetherAll)}>{togetherAll ? "Fewer" : `All ${s.verses.length}`}</button>
      {/if}
    {:else}
      <p class="dim">No verse names both {plainName(selected)} and {plainName(focus)}.</p>
    {/if}
  {:catch e}
    <p class="dim">Could not load the shared verses: {e.message}</p>
  {/await}
{/snippet}

<!-- The journey note, kept with Your Path as in the panel (decision 129). -->
{#snippet noteTab()}
  <label class="note-label" for="hud-note">Note on {label(selected)}</label>
  <textarea id="hud-note" rows="6" value={notes[selected] ?? ""} oninput={(e) => onnote(selected, e.currentTarget.value)}></textarea>
  <p class="dim small">Notes stay in this browser only. <button class="link" onclick={download}>Download notes</button></p>
{/snippet}

<style>
  /* The HUD's own palette: a cold cyan line on dark glass, so the scene shows through. */
  .hud {
    --hud-line: 127, 227, 255;
    --ink: #e8fbff;
    --mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    position: fixed;
    top: 72px;
    right: 16px;
    max-height: calc(100dvh - 72px - 96px); /* clear of the view picker and the footer */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 10px 16px 14px;
    color: var(--ink);
    isolation: isolate;
    z-index: 4; /* over the view picker and footer when dragged there; under the search results and the tour */
  }
  .hud.placed {
    right: auto;
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
      repeating-linear-gradient(0deg, rgba(var(--hud-line), 0.035) 0 1px, transparent 1px 3px),
      linear-gradient(160deg, rgba(var(--hud-line), 0.14), rgba(10, 22, 38, 0.42) 40%, rgba(10, 22, 38, 0.5));
    backdrop-filter: blur(3px) saturate(1.2);
    -webkit-backdrop-filter: blur(3px) saturate(1.2);
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
    stroke-width: 1;
  }
  .frame path {
    stroke: rgba(var(--hud-line), 0.95);
    stroke-width: 3;
  }

  /* Flicker: the card dips and stutters now and then, a band of interference rolls down the glass,
     and the name splits into red and cyan for an instant. Only with animation on. */
  .flicker {
    animation: flicker 7s infinite;
  }
  .flicker .glass::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0, rgba(var(--hud-line), 0.1) 48%, rgba(var(--hud-line), 0.18) 50%, transparent 54%);
    background-size: 100% 240px;
    background-repeat: no-repeat;
    animation: roll 24s linear infinite;
  }
  .flicker .name {
    animation: split 5s infinite;
  }
  @keyframes flicker {
    0%, 3.9%, 4.6%, 41%, 42.6%, 70%, 70.8%, 100% {
      opacity: 1;
      filter: none;
    }
    4% {
      opacity: 0.55;
    }
    4.3% {
      opacity: 0.9;
      filter: brightness(1.4);
    }
    41.5% {
      opacity: 0.75;
      transform: translateX(1px);
    }
    42% {
      opacity: 0.95;
      transform: translateX(-1px);
    }
    70.4% {
      opacity: 0.6;
    }
  }
  /* One slow pass of about 7 seconds, then the glass stays clear for the rest of the 24 second cycle. */
  @keyframes roll {
    0% {
      background-position: 0 -240px;
    }
    30%,
    100% {
      background-position: 0 calc(100% + 240px);
    }
  }
  @keyframes split {
    0%, 61%, 63.5%, 100% {
      text-shadow: 0 0 10px rgba(var(--hud-line), 0.45);
    }
    62% {
      text-shadow: -2px 0 rgba(255, 40, 110, 0.75), 2px 0 rgba(var(--hud-line), 0.85);
    }
    63% {
      text-shadow: 1px 0 rgba(255, 40, 110, 0.6), -1px 0 rgba(var(--hud-line), 0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flicker,
    .flicker .glass::after,
    .flicker .name,
    .body {
      animation: none !important;
    }
  }

  .strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 0 6px 14px;
    border-bottom: 1px solid rgba(var(--hud-line), 0.3);
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .strip:active {
    cursor: grabbing;
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
    border: 1px solid rgba(var(--hud-line), 0.6);
    color: rgb(var(--hud-line));
  }
  .tools {
    margin-left: auto;
    display: flex;
    gap: 2px;
  }
  .tool {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    color: rgba(var(--hud-line), 0.55);
    cursor: pointer;
  }
  .tool svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tool:hover,
  .tool[aria-pressed="true"] {
    color: rgb(var(--hud-line));
    filter: drop-shadow(0 0 3px rgba(var(--hud-line), 0.8));
  }
  .tool[aria-pressed="true"] svg {
    fill: currentColor;
  }
  .grip {
    cursor: grab;
  }

  .head {
    animation: scan 0.22s ease-out;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--hud-line), 0.4) transparent;
    animation: scan 0.22s ease-out;
  }
  .still .body,
  .still .head {
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
  .name {
    margin: 10px 0 2px;
    font-size: var(--fs-2xl);
    line-height: 1.15;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(var(--hud-line), 0.45);
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
    color: rgb(var(--hud-line));
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-size: var(--fs-xs);
  }
  .dim {
    color: rgba(232, 251, 255, 0.6);
  }
  .small {
    font-size: var(--fs-xs);
  }

  .tabs {
    display: flex;
    gap: 2px;
    margin: 10px 0 4px;
    border-bottom: 1px solid rgba(var(--hud-line), 0.3);
  }
  .tabs button {
    padding: 6px 10px 5px;
    border: 0;
    border-radius: 0;
    background: none;
    color: rgba(232, 251, 255, 0.6);
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
  }
  .tabs button:hover {
    color: var(--ink);
  }
  .tabs button[aria-selected="true"] {
    color: rgb(var(--hud-line));
    background: rgba(var(--hud-line), 0.14);
    box-shadow: inset 0 -2px 0 rgb(var(--hud-line));
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 6px;
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--c, rgb(var(--hud-line)));
  }
  h3::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(var(--hud-line), 0.5), transparent);
  }
  h3 .dim {
    letter-spacing: 0.05em;
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--c);
    box-shadow: 0 0 5px var(--c);
    transform: rotate(45deg);
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
    border-left: 2px solid rgba(var(--hud-line), 0.6);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }
  .clamp {
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
    background: rgba(var(--hud-line), 0.1);
    transform: skewX(-20deg);
  }
  .bar b.on {
    background: var(--c);
    box-shadow: 0 0 4px var(--c);
  }
  .n {
    text-align: right;
  }

  /* Links and shared Verses: rows that read as a terminal list. */
  .query,
  textarea {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 0;
    background: rgba(5, 12, 22, 0.55);
    box-shadow: inset 0 0 0 1px rgba(var(--hud-line), 0.45);
    color: var(--ink);
    font: 12px/1.4 var(--mono);
  }
  textarea {
    resize: vertical;
  }
  .query::placeholder {
    color: rgba(232, 251, 255, 0.45);
  }
  .rows,
  .verses {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: block;
    width: 100%;
    padding: 3px 6px;
    border: 0;
    border-left: 2px solid transparent;
    border-radius: 0;
    background: none;
    color: var(--ink);
    font: 12px/1.4 var(--mono);
    text-align: left;
    cursor: pointer;
  }
  /* The name and the reason it is listed: a clear gap between them, and the reason wraps under the name if it must. */
  .row .why {
    margin-left: 0.5ch;
  }
  .row:hover {
    border-left-color: rgb(var(--hud-line));
    background: rgba(var(--hud-line), 0.1);
  }
  .verses li {
    margin-bottom: 10px;
  }
  .ref {
    padding: 0;
    border: 0;
    background: none;
    color: rgb(var(--hud-line));
    font: 600 11px/1 var(--mono);
    letter-spacing: 0.1em;
    cursor: pointer;
  }
  .verses .text {
    margin-top: 4px;
  }
  .link {
    margin-top: 6px;
    padding: 0;
    border: 0;
    background: none;
    color: rgb(var(--hud-line));
    font: 11px/1.4 var(--mono);
    letter-spacing: 0.05em;
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .note-label {
    display: block;
    margin-top: 10px;
    font: 600 10px/1 var(--mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgb(var(--hud-line));
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(var(--hud-line), 0.3);
  }
  /* Buttons with a cut corner, outlined in the HUD's line. The clip-path that cuts the corner also cuts
     off any border or inset shadow on the diagonal, so the outline is a ::before layer clipped to a 1px
     ring of the same shape (evenodd: the outer outline, then the inner one, leaves only the ring). */
  .actions button {
    --edge: rgba(var(--hud-line), 0.8);
    position: relative;
    padding: 6px 10px;
    border: 0;
    border-radius: 0;
    background: rgba(var(--hud-line), 0.1);
    color: var(--ink);
    font: 600 11px/1 var(--mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
    cursor: pointer;
  }
  .actions button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--edge);
    pointer-events: none;
    clip-path: polygon(
      evenodd,
      6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px, 6px 0,
      6.4px 1px, 1px 6.4px, 1px calc(100% - 1px), calc(100% - 6.4px) calc(100% - 1px),
      calc(100% - 1px) calc(100% - 6.4px), calc(100% - 1px) 1px, 6.4px 1px
    );
  }
  .actions button:hover:not(:disabled) {
    --edge: rgb(var(--hud-line));
    background: rgba(var(--hud-line), 0.24);
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .actions .primary {
    --edge: rgb(var(--hud-line));
    background: rgba(var(--hud-line), 0.28);
  }
  .actions .more {
    margin-left: auto;
  }
  /* The corner grip, in the cut bottom right corner: three short diagonal lines. */
  .resize {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    background: linear-gradient(135deg, transparent 0 45%, rgba(var(--hud-line), 0.8) 45% 52%, transparent 52% 64%, rgba(var(--hud-line), 0.8) 64% 71%, transparent 71%);
    cursor: nwse-resize;
    touch-action: none;
  }

  /* Above the scene, below the HUD; a click goes through to the scene. */
  .lead {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    fill: none;
    stroke-width: 1;
  }
  .lead .brackets {
    stroke: rgba(127, 227, 255, 0.85);
    stroke-width: 1.25;
    filter: drop-shadow(0 0 2px rgba(127, 227, 255, 0.8));
  }
</style>
