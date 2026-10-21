<script lang="ts">
  // The detail panel: the Selected Node, the Verses it shares with the Focus and pins, its own data,
  // and the Neighbour lists. Props only; App owns the Focus Model state.
  import { untrack } from "svelte";
  import type { CorrectionRequest } from "./correction";
  import type { Data } from "./data";
  import NoteBox from "./NoteBox.svelte";
  import { passes, relation, relationWords, typeOf, TYPES, TYPE_NAME, type Action, type Evidence, type Id, type NodeType, type State } from "./model";
  import type { Notes } from "./session";

  let {
    data,
    model,
    label,
    apply,
    makeFocus,
    pin,
    onread,
    suggest,
    notes,
    onnote,
    download,
    deleteAll,
    noWebGL,
    collapsed,
    reading,
  }: {
    data: Data;
    model: State;
    label: (id: Id) => string;
    apply: (a: Action) => void;
    makeFocus: (id: Id) => void;
    pin: (id: Id) => void;
    onread: () => void;
    suggest: (kind: CorrectionRequest["kind"], nodeIds: Id[], currentValue: string) => void;
    notes: Notes;
    onnote: (id: Id, text: string) => void;
    download: () => void;
    deleteAll: () => void;
    noWebGL: boolean;
    collapsed: boolean;
    reading: boolean;
  } = $props();

  // The nodes whose Neighbours, and whose Verses shared with the Focus, the panel lists. A click in
  // a list keeps that list, so the second click of a double click lands on the same item.
  let neighboursOf = $state(untrack(() => model.selected));
  let versesOf = $state(untrack(() => model.selected));
  let keep: "neighbours" | "verses" | undefined;
  let opened = $state<Record<string, boolean>>({}); // "owner|type" lists opened with "N more"
  let selectedBox = $state<HTMLElement>();

  const selected = $derived(model.selected);
  // Separate from model so a list is loaded again only when its owner or the Focus changes.
  const focus = $derived(model.focus);

  // A new selection or Focus: the lists follow it, unless the click came from that list. (Read
  // through the deriveds, which change only with their value; model changes on every action.)
  $effect.pre(() => {
    const next = selected;
    void focus;
    untrack(() => {
      if (keep !== "neighbours") neighboursOf = next;
      if (keep !== "verses") {
        versesOf = next;
        selectedBox?.scrollTo(0, 0); // read from the name down, not from where a long entry was left
      }
      keep = undefined;
    });
  });
  function pick(id: Id, from: "neighbours" | "verses") {
    if (id !== model.selected) keep = from;
    apply({ type: "select", id });
  }

  const overflowType = (id: Id) => id.slice("overflow:".length) as NodeType;
  const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));
  // A name for "son of ...": without a hint or a parenthesis ("Benjamin (patriarch)" is "Benjamin").
  const plainName = (id: Id) => data.label(id, false).replace(/\s*\(.*\)$/, "");

  const selectedType = $derived(typeOf(selected) === "overflow" ? "Overflow Node" : TYPE_NAME[typeOf(selected) as NodeType]);
  // The Relationship is read from the Focus: Isaac is Abraham's son.
  const link = $derived(selected === model.focus ? undefined : data.record(model.focus)?.links.find((l) => l.id === selected));
  const linkWords = $derived(link && relation(link, data.genderOf, plainName(model.focus)));
  // The edges that give the words: the Co-mention for "together in N verses", else the others.
  const linkEdges = $derived(link?.edges.filter((e) => (e.edge === "CO_MENTION") === linkWords!.derived) ?? []);
  // A curated Relationship's first Evidence Verse, shown in the Relationship line (decision 135).
  const evidence = $derived(linkEdges.find((e) => e.evidence?.length)?.evidence![0].verse_key);

  // "Theographic, CC BY-SA 4.0"; a derived link has two sources, each with its own licence.
  function credit(edges: { source?: string; licence?: string }[]) {
    const each = edges.flatMap((e) => {
      const licences = e.licence?.split("; ") ?? [];
      return e.source?.split("; ").map((s, i) => `${s}, ${licences[i]}`) ?? [];
    });
    return [...new Set(each)].join("; ");
  }
  // Evidence Verses by reference, "Gen 36:24", as the rest of the page names Verses.
  const cited = (evidence: Evidence[]) => evidence.map((v) => data.label(v.verse_key)).join(", ");

  // A Retry in the panel loads both lists again.
  let retries = $state(0);
  // An Overflow Node lists all the Focus's Neighbours of its type.
  const listing = $derived.by(() => {
    retries;
    return typeOf(neighboursOf) === "overflow"
      ? data.loadWithKin(focus).then((r) => ({ r, types: [overflowType(neighboursOf)], whole: true }))
      : data.loadWithKin(neighboursOf).then((r) => ({ r, types: TYPES, whole: false }));
  });
  // The Verses `versesOf` shares with the Focus, then with each pin.
  const pins = $derived(model.pins);
  const sharing = $derived.by(() => {
    retries;
    return Promise.all(
      [...new Set([focus, ...pins])]
        .filter((o) => o !== versesOf && isEntity(versesOf) && isEntity(o))
        .map(async (o) => ({ with: o, verses: await data.shared(o, versesOf) })),
    );
  });
  // A built Verse's BSB text under its name (decision 138); not when the click came from the shared
  // list, which already shows it and must not move.
  const verseText = $derived(typeOf(selected) === "verse" && versesOf === selected && !data.outside(selected) ? data.load(selected).then((r) => r.text) : undefined);
  // The facts, corrections, and Dictionary Entry of the Selected Node, when it is an Entity.
  const details = $derived.by(() => {
    retries;
    return isEntity(selected) ? data.details(selected) : undefined;
  });
</script>

<aside id="panel" class="panel" class:collapsed class:full={noWebGL} class:reading aria-label="Selected Node">
  {#if noWebGL}
    <p class="fallback">This browser has no WebGL, so the graph is not drawn. The lists below work alone: a click selects, a double click makes the Focus.</p>
  {/if}
  <!-- Fixed height, so the Neighbour lists below never move between the two clicks of a double click. -->
  <section class="selected" bind:this={selectedBox}>
    <!-- The name, the type line, and the Relationship line have fixed heights, so the shared Verses
         below never move between the two clicks of a double click; a long text is cut, and whole
         in its title. -->
    <h2 class="line" title={label(selected)}>{label(selected)}</h2>
    {#await details}{@render typeLine()}{:then d}{@render typeLine(d && credit([d]))}{:catch}{@render typeLine()}{/await}
    {#if verseText}
      {#await verseText then t}<p class="verse-full">{t}</p>{/await}
    {/if}
    <!-- Each item (type, Relationship, fact, linked Verse) has its source and licence in its hover
         title only; the credits page lists them all (decision 139). A Verse's own text has no
         shared list below it to hold in place, so an empty line is not kept for it. -->
    <p class="relationship" hidden={!link && !!verseText} title={link && `Relationship: ${linkWords!.text}${evidence ? ` (${data.label(evidence)})` : ""}. ${credit(linkEdges)}`}>
      <!-- The one Relationship line keeps the full words; the lists drop the fixed ones (decision 142). -->
      {#if link}<span class="words">Relationship: <b>{linkWords!.text}</b>
          {#if evidence}(<button class="ref" onclick={() => apply({ type: "select", id: evidence })}>{data.label(evidence)}</button>){/if}</span>
        {@render fix("the Relationship", "relationship", [model.focus, selected], `${plainName(selected)}: ${linkWords!.text}`)}{/if}
    </p>
    {#if data.outside(selected)}<p class="muted">{data.outside(selected)}</p>{/if}
    <button data-tour="make-focus" onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
    {#if model.pins.includes(selected)}
      <button onclick={() => apply({ type: "unpin", id: selected })}>Unpin</button>
    {:else}
      <button data-tour="pin" onclick={() => pin(selected)}>Pin</button>
    {/if}
    <button onclick={() => apply({ type: "step", dir: -1 })}>Prev</button>
    <button data-tour="next" onclick={() => apply({ type: "step", dir: 1 })}>Next</button>
    <button data-tour="read" onclick={onread} disabled={typeOf(selected) === "overflow"}>Read</button>
    <button onclick={() => suggest(typeOf(selected) === "verse" ? "verse" : "fact", [selected], `${selectedType}: ${label(selected)}`)} disabled={typeOf(selected) === "overflow"}>
      Suggest a correction
    </button>
    {#await sharing then lists}
      {#each lists as { with: o, verses }, i (o)}
        {#if verses.length}
          <h3 id="shared-{i}">Together {o === focus ? "" : `with ${label(o)} `}in {verses.length} verse{verses.length === 1 ? "" : "s"}</h3>
          <ul aria-labelledby="shared-{i}">
            {#each verses as v (v.key)}
              <li>{@render item(v.key, "", "verses")}<p class="verse-text">{v.text}</p></li>
            {/each}
          </ul>
        {/if}
      {/each}
    {:catch e}
      {@render failed("the shared verses", e)}
    {/await}
    <!-- Below the shared Verses, whose list must not move between the two clicks of a double
         click: the journey note and what the Selected Node's own data says, which a click on a
         shared Verse removes. -->
    {#if selected === model.focus || model.path.includes(selected)}
      <NoteBox name={label(selected)} text={notes[selected] ?? ""} onnote={(t) => onnote(selected, t)} {download} {deleteAll} />
    {/if}
    {#each linkEdges.filter((e) => e.note) as e, i (i)}
      <p class="note">Note on the Relationship: {e.note} Evidence: {cited(e.evidence!)}.{@render request(e.request)}</p>
    {/each}
    {#await details then d}
      {#if d?.facts.length}
        <ul class="facts" aria-label="Facts">
          {#each d.facts as f (f.name)}
            <li title={credit([f])}><span class="muted">{f.name}</span> {f.value} {@render fix(f.name, "fact", [selected], `${f.name}: ${f.value}`)}</li>
          {/each}
        </ul>
      {/if}
      {#if d?.corrections.length}
        <ul class="facts" aria-label="Corrections">
          {#each d.corrections as c, i (i)}
            <li title={credit([c])}>Corrected after review: {c.field} ({cited(c.evidence)}). <span class="muted">{c.note}</span>{@render request(c.request)}</li>
          {/each}
        </ul>
      {/if}
      {#if d?.entry}
        {@const [first, ...rest] = d.entry.text.split(/\n\s*\n\s*/)}
        {@const key = `${selected}|entry`}
        <section class="entry" aria-labelledby="entry">
          <h3 id="entry" title={d.entry.licence}>{d.entry.source}</h3>
          {#each opened[key] ? [first, ...rest] : [first] as paragraph, i (i)}<p>{paragraph}</p>{/each}
          {#if rest.length}
            <button class="more" aria-expanded={!!opened[key]} onclick={() => (opened[key] = !opened[key])}>{opened[key] ? "Read less" : "Read more"}</button>
          {/if}
        </section>
      {/if}
    {:catch e}
      {@render failed("the details", e)}
    {/await}
  </section>
  {#await listing then list}
    <!-- An Entity's linked Verses are in Bible order (Verse Keys sort so). Each item has its source
         in its title and a correction link after it; a link between two Entities is a
         Relationship, sent as the Relationship line sends it. -->
    {#each list.types as t (t)}
      {@const linked = t === "verse" && isEntity(list.r.id)}
      {@const found = list.r.links.filter((l) => l.type === t && l.id !== list.r.id && passes(l, model.filters, data.bookOf))}
      {@const all = linked ? found.sort((a, b) => (a.id < b.id ? -1 : 1)) : found}
      {@const key = `${neighboursOf}|${t}`}
      {@const k = model.filters.k}
      {#if all.length}
        <h3 id="list-{t}">{TYPE_NAME[t]} ({all.length})</h3>
        <ol aria-labelledby="list-{t}" data-tour="list-{t}">
          {#each list.whole || opened[key] ? all : all.slice(0, k) as l (l.id)}
            {@const words = relation(l, data.genderOf, plainName(list.r.id)).text}
            {@const shown = relationWords(list.r.type, l, data.genderOf, plainName(list.r.id)).text}
            {@const kin = isEntity(list.r.id) && isEntity(l.id)}
            <li title={credit(l.edges)}>
              {@render item(l.id, shown, "neighbours")}
              {@render fix(
                `the link to ${data.label(l.id)}`,
                kin ? "relationship" : "verse",
                [list.r.id, l.id],
                kin ? `${plainName(l.id)}: ${words}` : `${plainName(list.r.id)}: ${words} (${data.label(l.id)})`,
              )}
            </li>
          {/each}
        </ol>
        {#if !list.whole && all.length > k}
          <button class="more" data-tour="more-{t}" aria-expanded={!!opened[key]} onclick={() => (opened[key] = !opened[key])}>
            <span aria-hidden="true">{opened[key] ? "▾" : "▸"}</span>
            {opened[key] ? `Show ${linked ? "first" : "top"} ${k}` : `${all.length - k} more`}
          </button>
        {/if}
      {/if}
    {/each}
  {:catch e}
    <!-- A Verse outside the build has no lists; the note above says why. -->
    {#if !data.outside(neighboursOf)}{@render failed("the Neighbours", e)}{/if}
  {/await}
</aside>

<!-- A click selects and a double click makes the Focus, as in the scene. -->
{#snippet item(id: Id, words: string, from: "neighbours" | "verses")}
  <button class="item" class:sel={id === selected} onclick={() => pick(id, from)} ondblclick={() => makeFocus(id)}>
    {data.label(id, false)}
    {#if words}<span class="muted">{words}</span>{/if}
  </button>
{/snippet}
<!-- A small link that opens the correction form for one item. -->
{#snippet fix(what: string, kind: CorrectionRequest["kind"], nodeIds: Id[], currentValue: string)}
  <button class="fix" aria-label="Suggest a correction to {what}" title="Suggest a correction" onclick={() => suggest(kind, nodeIds, currentValue)}>Suggest a correction</button>
{/snippet}
{#snippet typeLine(source?: string)}
  <p class="muted line" title={source ? `${selectedType}, from ${source}` : selectedType}>{selectedType}</p>
{/snippet}
{#snippet request(url?: string | null)}
  {#if url}{" "}<a href={url} target="_blank" rel="noopener">Request #{url.slice(url.lastIndexOf("/") + 1)}</a>{/if}
{/snippet}
{#snippet failed(what: string, e: Error)}
  <p class="muted">Could not load {what}: {e.message} <button onclick={() => retries++}>Retry</button></p>
{/snippet}

<style>
  /* The panel starts below the top strip, so it never covers the Your Path bar there. */
  .panel {
    position: fixed;
    top: 56px;
    right: 0;
    bottom: 0;
    width: 340px;
    box-sizing: border-box;
    padding: 12px 16px;
    overflow-y: auto;
    background: rgba(20, 23, 34, 0.92);
    border-left: 1px solid #262a3c;
    transition: transform 0.2s;
  }
  /* Below the search box and the hint, and right of the reader drawer when it is open. */
  .panel.full {
    top: 132px;
    left: 0;
    width: auto;
    bottom: 92px; /* above the footer, the notes, and the controls, as the reader drawer */
  }
  .panel.full.reading {
    left: 412px;
  }
  .panel.collapsed {
    transform: translateX(100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      transition: none;
    }
  }
  .fallback {
    color: #ffd27a;
  }
  /* A soft fade at the bottom edge while more of the section is below (decision 148). The scroll
     timeline sets its height, and is inactive when nothing overflows, leaving it at 0. The second
     mask layer keeps the bottom border. A control focused with the keyboard is never faded. */
  @property --fade {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }
  @keyframes fade-hint {
    from {
      --fade: 24px;
    }
    to {
      --fade: 0px;
    }
  }
  .selected {
    height: 55%;
    overflow-y: auto;
    border-bottom: 1px solid #262a3c;
    mask:
      linear-gradient(#000 calc(100% - var(--fade)), transparent),
      linear-gradient(#000 0 0) bottom / 100% 1px no-repeat;
    animation: fade-hint linear both;
    animation-timeline: scroll(self);
    animation-range: calc(100% - 24px) 100%; /* it shrinks over the last 24px of scrolling */
  }
  .selected:has(:focus-visible) {
    animation: none;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  h3 {
    margin: 14px 0 4px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9aa0b4;
  }
  p {
    margin: 4px 0;
    min-height: 1.45em;
  }
  ol,
  ul {
    margin: 0;
    padding-left: 22px;
  }
  .item {
    padding: 1px 4px;
    border: 0;
    background: none;
    text-align: left;
    vertical-align: top; /* a name that wraps keeps its number on the first line */
  }
  .item.sel {
    background: #262a3c;
  }
  .item .muted {
    font-size: 12px;
  }
  .verse-text {
    margin: 0 0 8px 4px;
    opacity: 0.85;
  }
  /* A long Verse scrolls in its own box, so the buttons below it stay in reach. */
  .verse-full {
    max-height: 11.6em;
    overflow-y: auto;
    margin: 6px 0;
  }
  .more {
    margin: 4px 0;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    color: #9aa0b4;
  }
  .more[aria-expanded="true"] {
    color: #ffd27a;
  }
  .muted {
    color: #9aa0b4;
  }
  /* One line, cut with an ellipsis. */
  .line {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Three lines whether or not there is a Relationship: two for the words, then its correction
     link. */
  .relationship {
    height: 4.35em;
    overflow: hidden;
  }
  .words {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  /* A list row's correction link shows on hover, on keyboard focus, or for the Selected Node
     (decision 139). */
  /* In a list row it is a small flag at the row's right edge, laid over the row so showing it never
     moves anything; it stays in the tab order and shows on keyboard focus (decision 143). */
  li:has(> .fix) {
    position: relative;
    padding-right: 22px;
  }
  li > .fix {
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    overflow: hidden;
    text-decoration: none;
    font-size: 0;
  }
  li > .fix::before {
    content: "\2691";
    font-size: 12px;
  }
  li > .fix:hover,
  li > .fix:focus-visible {
    color: #ffd27a;
  }
  /* Faded, not hidden, so screen readers and the keyboard still find it. */
  li:not(:hover, :focus-within, :has(.sel)) > .fix {
    opacity: 0;
  }
  /* An Evidence Verse in the Relationship line: a reference that selects it. */
  .ref {
    padding: 0;
    border: 0;
    background: none;
    color: #ffd27a;
  }
  .fix {
    padding: 0;
    border: 0;
    background: none;
    font-size: 11px;
    color: #9aa0b4;
    text-decoration: underline;
  }
  .facts {
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }
  .note {
    font-size: 13px;
    color: #c8cde0;
  }
  a {
    color: #ffd27a;
  }
  .entry p {
    min-height: 0;
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
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
