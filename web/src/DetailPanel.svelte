<script lang="ts">
  // The detail panel: the Selected Node, the Verses it shares with the Focus and pins, its own data,
  // and the Neighbour lists. Props only; App owns the Focus Model state.
  import { untrack, type Snippet } from "svelte";
  import VerseText from "./VerseText.svelte";
  import VerseKey from "./VerseKey.svelte";
  import { OwnVerses, VERSE_STEP } from "./verses.svelte";
  import { typeColour } from "./colours";
  import type { CorrectionRequest } from "./correction";
  import type { Data } from "./data";
  import NoteBox from "./NoteBox.svelte";
  import PlaceMap from "./PlaceMap.svelte";
  import { fold, passing, relation, relationWords, typeOf, TYPES, TYPE_NAME, TYPE_PLURAL, type Action, type Evidence, type Id, type NodeType, type State } from "./model";
  import { screen } from "./screen.svelte";
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
    controls,
    filtersAndLinks,
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
    controls?: Snippet; // after the held name and actions: on a phone, the view picker, Filters, and Copy link
    filtersAndLinks?: Snippet; // after the lists: on a phone, the filters and the page's own links
  } = $props();

  // The nodes whose Neighbours, and whose Verses shared with the Focus, the panel lists. A click in
  // a list keeps that list, so the second click of a double click lands on the same item.
  let neighboursOf = $state(untrack(() => model.selected));
  let versesOf = $state(untrack(() => model.selected));
  let keep: "neighbours" | "verses" | undefined;
  let opened = $state<Record<string, boolean>>({}); // "owner|type" lists opened with "N more"
  let selectedBox = $state<HTMLElement>();
  // The header's height, rounded up, and a pixel more: the panel scrolls by whole pixels, so with a
  // header of fractional height a control scrolled into view could stop a fraction under it.
  let headBox = $state<ResizeObserverSize[]>();
  const headHeight = $derived(Math.ceil(headBox?.[0]?.blockSize ?? 0) + 1);
  const RING = 2; // the focus ring's width, outside a control (focus.css)
  // Long lists show 100 rows at a time (decision 165): rows shown per list, by a key naming the list.
  const PAGE = 100;
  let pages = $state<Record<string, number>>({});
  const paged = <T,>(key: string, rows: T[]) => rows.slice(0, pages[key] ?? PAGE);
  // A long list's filter box (decision 202): the query per list, by the same "owner|type" key as
  // `opened`. Dropped when the lists' owner or the Focus changes; not in the address.
  let queries = $state<Record<string, string>>({});
  let queriedFocus = untrack(() => model.focus);

  const selected = $derived(model.selected);
  // A phone, upright or on its side: the Selected Node's section is too short to hold its actions.
  const compact = $derived(screen.phone);
  // Separate from model so a list is loaded again only when its owner or the Focus changes.
  const focus = $derived(model.focus);

  // On a desktop window everything below the header is one column, so a selection changes what lies
  // above a list and the header's own height (decision 201). The list item (or the map block) a
  // selection was made in is held where it was on screen, by scrolling the panel each time anything
  // in it changes, until the panel is scrolled some other way, a press lands elsewhere, or the window
  // is resized; so the second click of a double click lands where the first did. When the panel
  // cannot scroll back far enough (it is at its top), a spacer under the header makes up the rest; it
  // goes when the hold ends.
  let panelBox = $state<HTMLElement>();
  let spacer = $state<HTMLElement>();
  let mapBox = $state<HTMLElement>();
  let held: { el: Element; top: number } | undefined; // the item held, and where it was on screen
  let fromColumn = false; // the selection under way was made in the column
  let scrolled = 0; // where the panel's own scrolling left it
  function hold(el: Element) {
    if (compact) return;
    held = { el, top: el.getBoundingClientRect().top };
    fromColumn = true;
  }
  // The spacer goes. Scrolled back by its height, what lies below it stays where it was; at the
  // panel's top the panel cannot scroll back, so the column closes up by the rest. A fraction of a
  // pixel stays: it is no gap, and taking it out would move the column by that fraction.
  function closeSpacer() {
    if (!spacer || !panelBox) return;
    const space = parseFloat(spacer.style.height) || 0, // its own style, so a wheel forces no layout
      whole = Math.floor(space);
    if (!whole) return;
    spacer.style.height = `${space - whole}px`;
    panelBox.scrollTop -= Math.min(panelBox.scrollTop, whole);
    scrolled = panelBox.scrollTop;
  }
  function release() {
    held = undefined;
    closeSpacer();
  }
  function keepHeld() {
    if (!held || !panelBox || !spacer) return;
    if (!held.el.isConnected) return release();
    const off = () => held!.el.getBoundingClientRect().top - held!.top,
      space = () => spacer!.getBoundingClientRect().height;
    let drift = off();
    if (Math.abs(drift) < 0.05) return;
    // Where the panel would scroll to, counting the spacer as scrolling above the top.
    const to = panelBox.scrollTop - space() + drift;
    spacer.style.height = `${Math.max(0, -to)}px`;
    panelBox.scrollTop = Math.max(0, to);
    // The panel scrolls by whole pixels: the spacer takes up the fraction left.
    drift = off();
    if (drift > space()) {
      panelBox.scrollTop += 1;
      drift = off();
    }
    spacer.style.height = `${Math.max(0, space() - drift)}px`;
    scrolled = panelBox.scrollTop;
  }
  // A press, a key, or a wheel anywhere else in the panel ends the hold: what it changes (Show map,
  // Read more) moves what lies below, as without a hold. In the map any press ends it (a pan, a zoom,
  // a dot), as the click on a dot that made the selection is over before the selection comes
  // (map.ts waits the double click time). After a pointer's press the spacer goes once the click is
  // over, so the press lands where it began, unless that click started a new hold, which keeps it.
  const releaseOnOtherPress = (e: Event) => {
    if (held && held.el !== mapBox && held.el.contains(e.target as Node)) return; // the second click of a double click
    held = undefined;
    if (e.type !== "pointerdown") return closeSpacer();
    addEventListener("pointerup", () => setTimeout(() => held || closeSpacer()), { once: true });
  };
  $effect(() => {
    const panel = panelBox;
    if (!panel || compact) return;
    // Leaflet moves the map's tiles and dots in every frame of a pan or a zoom, and the map block
    // keeps one height (decision 194), so its attributes are not watched; nor are attributes that
    // never move anything.
    const observer = new MutationObserver((records) => {
      if (held && records.some((r) => r.type !== "attributes" || !mapBox?.contains(r.target))) keepHeld();
    });
    observer.observe(panel, { subtree: true, childList: true, characterData: true, attributeFilter: ["class", "style", "hidden"] });
    // In the capture phase: the map stops its own presses, keys, and wheels on their way up.
    const events = ["pointerdown", "keydown", "wheel"];
    for (const e of events) panel.addEventListener(e, releaseOnOtherPress, { capture: true, passive: true });
    // A resize moves what is held, so a later change must not scroll it back where it was.
    addEventListener("resize", release);
    return () => {
      observer.disconnect();
      for (const e of events) panel.removeEventListener(e, releaseOnOtherPress, { capture: true });
      removeEventListener("resize", release);
      release(); // and when the layout becomes the phone's
    };
  });
  // "together in N verses" in the Relationship line scrolls to the verses themselves, which the
  // hold of a clicked list item may have left above the view.
  function showVerses() {
    release();
    const list = panelBox?.querySelector("#shared-0, #own-verses");
    list?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    (list?.nextElementSibling?.querySelector("button") as HTMLElement | null)?.focus({ preventScroll: true });
  }
  function onscroll() {
    if (compact || !panelBox) return;
    if (Math.abs(panelBox.scrollTop - scrolled) > 1) release();
    scrolled = panelBox.scrollTop;
  }

  // A new selection or Focus: the lists follow it, unless the click came from that list. (Read
  // through the deriveds, which change only with their value; model changes on every action.)
  $effect.pre(() => {
    const next = selected;
    void focus;
    untrack(() => {
      if (keep !== "neighbours" || focus !== queriedFocus) {
        queries = {};
        queriedFocus = focus;
      }
      if (keep !== "neighbours") neighboursOf = next;
      if (keep !== "verses") {
        versesOf = next;
        selectedBox?.scrollTo(0, 0); // read from the name down, not from where a long entry was left
      }
      // On a desktop window a selection made outside the column, or a new Focus, also reads from
      // the name down; one made in the column holds where it was clicked.
      if (!compact && !fromColumn) {
        held = undefined;
        if (spacer) spacer.style.height = "0px";
        panelBox?.scrollTo(0, 0);
      }
      keep = undefined;
      fromColumn = false;
    });
  });
  function pick(id: Id, from: "neighbours" | "verses", el: Element) {
    if (id !== model.selected) {
      keep = from;
      hold(el);
    }
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
    // The names in bold in each list's Verses: both nodes the list is about, from the search index
    // (decision 208), so they come with the list and never after it.
    const names = (o: Id) => [versesOf, o].flatMap((id) => data.named(id) ?? []);
    return Promise.all(
      [...new Set([focus, ...pins])]
        .filter((o) => o !== versesOf && isEntity(versesOf) && isEntity(o))
        .map(async (o) => ({ with: o, names: names(o), verses: await data.shared(o, versesOf) })),
    );
  });
  // The Focus shares no Verses with itself: selected, it lists its own, a page at a time (decision 223).
  // Only 5 at first, so the Neighbour lists below stay near the top.
  const own = new OwnVerses(() => data, () => (versesOf === focus && isEntity(versesOf) ? versesOf : undefined), 5);
  // A built Verse's BSB text under its name (decision 138); not when the click came from the shared
  // list, which already shows it and must not move.
  const verseText = $derived(typeOf(selected) === "verse" && versesOf === selected && !data.outside(selected) ? data.load(selected).then((r) => r.text) : undefined);
  // The facts, corrections, and Dictionary Entry of the Selected Node, when it is an Entity.
  const details = $derived.by(() => {
    retries;
    return isEntity(selected) ? data.details(selected) : undefined;
  });
</script>

<aside id="panel" class="panel" class:collapsed class:full={noWebGL} aria-label="Selected Node" style:--head={compact ? undefined : `${headHeight + RING}px`} bind:this={panelBox} {onscroll}>
  {#if noWebGL}
    <p class="fallback">
      This browser has no WebGL, so the graph is not drawn. The lists below work alone:
      {screen.coarse ? "a tap selects, a double tap makes the Focus." : "a click selects, a double click makes the Focus."}
    </p>
  {/if}
  <!-- On a phone, a section of fixed height, so the Neighbour lists below never move between the two
       taps of a double tap. On a desktop window it draws no box of its own: its header stays at the
       top of the panel and the rest scrolls behind it, one column with the lists (decision 201). -->
  <!-- On a phone the name, the type line and the actions are one block held at the top of the
       panel, right under the tabs, so they show even when the sheet is low; the section of fixed
       height follows, its blank space (if any) at its foot, above the lists. -->
  {#if compact}
    <div class="held">
      <div class="name">{@render nameLines()}</div>
      <div class="actions">{@render actions()}</div>
    </div>
  {/if}
  <!-- On a phone the view picker, Filters and Copy link, below the held block: the sheet's peek
       height shows the node, not the controls. -->
  {@render controls?.()}
  <section class="selected" bind:this={selectedBox}>
    <!-- The name, the type line, the Relationship line when there is one, and on a desktop window the
         buttons; a long text is cut, and whole in its title. -->
    <div class="head" bind:borderBoxSize={headBox}>
      {#if !compact}{@render nameLines()}{/if}
      {#if compact}{@render verse()}{/if}
      <!-- Each item (type, Relationship, fact, linked Verse) has its source and licence in its hover
           title only; the credits page lists them all (decision 139). On a phone the line keeps its
           height when empty, so the shared Verses below it never move between two taps, except
           under a Verse's own text, which has no shared list below it to hold in place. -->
      <p class="relationship" hidden={!link && (!compact || !!verseText)} title={link && `Relationship: ${linkWords!.text}${evidence ? ` (${data.label(evidence)})` : ""}. ${credit(linkEdges)}`}>
        <!-- The one Relationship line keeps the full words; the lists drop the fixed ones (decision 142). -->
        {#if link}<span class="words">Relationship: {#if linkWords!.derived}<button class="jump" title="Go to the verses" onclick={showVerses}>{linkWords!.text}</button>{:else}<b>{linkWords!.text}</b>{/if}
            {#if evidence}(<button class="ref" onclick={() => apply({ type: "select", id: evidence })}>{data.label(evidence)}</button>){/if}</span>
          {@render fix("the Relationship", "relationship", [model.focus, selected], `${plainName(selected)}: ${linkWords!.text}`)}{/if}
      </p>
      {#if !compact}<div class="buttons">{@render actions()}</div>{/if}
    </div>
    {#if !compact}<div class="spacer" bind:this={spacer}></div>{/if}
    {#if !compact}{@render verse()}{/if}
    {#if data.outside(selected)}<p class="muted">{data.outside(selected)}</p>{/if}
    {#if own.failed}
      <p class="muted">Could not load the verses: {own.failed}</p>
    {:else if own.keys?.length && own.rows.length}
      {@const names = data.named(versesOf) ? [data.named(versesOf)!] : []}
      <h3 id="own-verses">In {own.keys.length} verse{own.keys.length === 1 ? "" : "s"}</h3>
      <VerseKey {names} underlined={own.rows.some((v) => v.terms.length)} />
      <ul aria-labelledby="own-verses">
        {#each own.rows as v (v.key)}
          <li>{@render item(v.key, "", "verses")}<p class="verse-text"><VerseText text={v.text} {names} terms={v.terms} /></p></li>
        {/each}
      </ul>
      {#if own.rows.length < own.keys.length}
        <button class="more" disabled={own.busy} onclick={() => own.more()}>{own.busy ? "Loading…" : `Show ${Math.min(VERSE_STEP, own.keys.length - own.rows.length)} more (${own.rows.length} of ${own.keys.length})`}</button>
      {/if}
    {/if}
    {#await sharing then lists}
      {#each lists as { with: o, names, verses }, i (o)}
        {#if verses.length}
          <h3 id="shared-{i}">Together {o === focus ? "" : `with ${label(o)} `}in {verses.length} verse{verses.length === 1 ? "" : "s"}</h3>
          <VerseKey {names} underlined={verses.some((v) => v.terms.length)} />
          <ul aria-labelledby="shared-{i}">
            {#each paged(`${versesOf}|${o}`, verses) as v (v.key)}
              <!-- A Person's or a Place's name in bold and its type's colour: text and strong elements,
                   never markup from the data, so the Verse's text stays one string. -->
              <li>{@render item(v.key, "", "verses")}<p class="verse-text"><VerseText text={v.text} {names} terms={v.terms} /></p></li>
            {/each}
          </ul>
          {@render more(`${versesOf}|${o}`, verses.length)}
        {/if}
      {/each}
    {:catch e}
      {@render failed("the shared verses", e)}
    {/await}
    <!-- Below the shared Verses, whose list must not move between the two clicks of a double
         click: what the Selected Node's own data says, then the journey note, both of which a click
         on a shared Verse removes. The node's content comes before the reader's own note. -->
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
    {#if selected === model.focus || model.path.includes(selected)}
      <NoteBox name={label(selected)} text={notes[selected] ?? ""} onnote={(t) => onnote(selected, t)} {download} {deleteAll} />
    {/if}
  </section>
  <!-- The map's own block, below the Selected Node's section (on a phone, below its actions), so the
       map can be taller than the section allows. It keeps one height whatever it shows, so the lists
       below never move between the two clicks of a double click; on a desktop window a selection
       made on the map holds the block where it was (decision 201). -->
  <div bind:this={mapBox}>
    <PlaceMap
      {data}
      {model}
      select={(id) => {
        if (id !== model.selected) hold(mapBox!);
        apply({ type: "select", id });
      }}
      {makeFocus}
    />
  </div>
  {#await listing then list}
    <!-- An Entity's linked Verses are in Bible order (Verse Keys sort so). Each item has its source
         in its title and a correction link after it; a link between two Entities is a
         Relationship, sent as the Relationship line sends it. -->
    {#each list.types as t (t)}
      {@const linked = t === "verse" && isEntity(list.r.id)}
      {@const found = passing(list.r, t, model.filters, data.bookOf)}
      {@const all = linked ? found.sort((a, b) => (a.id < b.id ? -1 : 1)) : found}
      {@const key = `${neighboursOf}|${t}`}
      {@const pageKey = `${list.r.id}|${key}`}
      {@const k = model.filters.k}
      {@const query = all.length > k ? fold(queries[key] ?? "") : ""}
      {@const rows = query ? all.filter((l) => fold(data.label(l.id, false)).includes(query)) : all}
      {#if all.length}
        <h3 id="list-{t}">{TYPE_NAME[t]} ({query ? `${rows.length} of ` : ""}{all.length})</h3>
        <!-- A list longer than the top K cut has a box that searches all of it, and lists every match
             as an opened list does (decision 202). -->
        {#if all.length > k}
          <div class="filter">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14" /></svg>
            <input
              type="search"
              aria-label="Filter {TYPE_NAME[t]}"
              placeholder="Filter {all.length} {TYPE_PLURAL[t]}"
              autocomplete="off"
              value={queries[key] ?? ""}
              oninput={(e) => {
                queries[key] = e.currentTarget.value;
                pages[pageKey] = PAGE;
              }}
              onkeydown={(e) => {
                if (e.key === "Escape" && queries[key]) {
                  queries[key] = "";
                  pages[pageKey] = PAGE;
                }
              }}
            />
            {#if query}
              <button
                class="clear"
                aria-label="Clear filter {TYPE_NAME[t]}"
                onclick={(e) => {
                  queries[key] = "";
                  pages[pageKey] = PAGE;
                  e.currentTarget.parentElement!.querySelector("input")!.focus();
                }}>Clear</button
              >
            {/if}
            <span class="live" aria-live="polite">{query ? `${rows.length} of ${all.length} match` : ""}</span>
          </div>
        {/if}
        {#if !rows.length}
          <p class="muted">No match</p>
        {:else}
          <ol aria-labelledby="list-{t}" data-tour="list-{t}">
            {#each query || list.whole || opened[key] ? paged(pageKey, rows) : all.slice(0, k) as l (l.id)}
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
        {/if}
        {#if query || list.whole || opened[key]}{@render more(pageKey, rows.length)}{/if}
        {#if !query && !list.whole && all.length > k}
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
  {@render filtersAndLinks?.()}
</aside>

<!-- What the reader can do with the Selected Node. On a phone, upright or on its side, they are one
     row below its section, held at the top of the panel while the lists scroll, and the correction
     link is a flag. -->
{#snippet actions()}
  <!-- Make Focus is the one primary action. On the Focus itself it is a badge, not a greyed button. -->
  {#if selected === model.focus}
    <span class="badge" title="{label(selected)} is the Focus">Focus</span>
  {:else}
    <button
      class="primary"
      data-tour="make-focus"
      onclick={() => makeFocus(selected)}
      disabled={typeOf(selected) === "overflow"}
      title={typeOf(selected) === "overflow" ? "A group of nodes cannot be the Focus: pick one from its list" : undefined}>Make Focus</button
    >
  {/if}
  {#if model.pins.includes(selected)}
    <button onclick={() => apply({ type: "unpin", id: selected })}>Unpin</button>
  {:else}
    <button data-tour="pin" onclick={() => pin(selected)}>Pin</button>
  {/if}
  <button data-tour="read" onclick={onread} disabled={typeOf(selected) === "overflow"}>Read</button>
  <!-- Prev and Next step the selection along Your Path; on a desktop window the pair is captioned. -->
  <span class="path-step" role="group" aria-label="Step along Your Path">
    {#if !compact}<span class="caption" aria-hidden="true">Your Path</span>{/if}
    <button title="Previous step on Your Path" onclick={() => apply({ type: "step", dir: -1 })}><span aria-hidden="true">‹&nbsp;</span>Prev</button>
    <button title="Next step on Your Path" data-tour="next" onclick={() => apply({ type: "step", dir: 1 })}>Next<span aria-hidden="true">&nbsp;›</span></button>
  </span>
  <button
    class="quiet"
    class:flag={compact}
    aria-label={compact ? "Suggest a correction" : undefined}
    title={compact ? "Suggest a correction" : undefined}
    onclick={() => suggest(typeOf(selected) === "verse" ? "verse" : "fact", [selected], `${selectedType}: ${label(selected)}`)}
    disabled={typeOf(selected) === "overflow"}
  >
    {compact ? "\u2691" : "Suggest a correction"}
  </button>
{/snippet}
<!-- A click selects and a double click makes the Focus, as in the scene. -->
{#snippet item(id: Id, words: string, from: "neighbours" | "verses")}
  <button class="item" class:sel={id === selected} onclick={(e) => pick(id, from, e.currentTarget)} ondblclick={() => makeFocus(id)}>
    {data.label(id, false)}
    {#if words}<span class="muted">{words}</span>{/if}
  </button>
{/snippet}
<!-- Below a paged list: the next 100 rows, and how many of the list show. -->
{#snippet more(key: string, total: number)}
  {@const shown = Math.min(total, pages[key] ?? PAGE)}
  {#if shown < total}
    <button class="more" onclick={() => (pages[key] = shown + PAGE)}>Show {Math.min(PAGE, total - shown)} more ({shown} of {total})</button>
  {/if}
{/snippet}
<!-- A small link that opens the correction form for one item. -->
{#snippet fix(what: string, kind: CorrectionRequest["kind"], nodeIds: Id[], currentValue: string)}
  <button class="fix" aria-label="Suggest a correction to {what}" title="Suggest a correction" onclick={() => suggest(kind, nodeIds, currentValue)}>Suggest a correction</button>
{/snippet}
{#snippet verse()}
  {#if verseText}
    {#await verseText then t}<p class="verse-full">{t}</p>{/await}
  {/if}
{/snippet}
{#snippet nameLines()}
  <h2 class="line" title={label(selected)}>{label(selected)}</h2>
  {#await details}{@render typeLine()}{:then d}{@render typeLine(d && credit([d]))}{:catch}{@render typeLine()}{/await}
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
  /* On a desktop window the page's grid places the panel: below the top row, so it never covers the
     Your Path bar there. */
  .panel {
    box-sizing: border-box;
    padding: 12px 16px;
    overflow-y: auto;
    background: var(--surface);
    border-left: 1px solid var(--line);
    transition: transform 0.2s;
    overflow-anchor: none; /* the panel holds a clicked item itself (decision 201), in every browser */
  }
  .panel.collapsed {
    transform: translateX(100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      transition: none;
    }
  }
  /* On a phone the panel fills the Details tab of the bottom sheet, which places it. */
  /* A target scrolled into view (by the tour) lands below the name and actions held at its top, and
     one scrolled to the end (the note being typed) clear of the bottom by a few px, as scrollTop is
     whole px while the rows are not. */
  :global(html[data-phone]) .panel {
    scroll-padding-top: calc(var(--held) + 8px);
    scroll-padding-bottom: 4px;
    position: static;
    width: auto;
    height: 100%;
    padding-top: 0;
    background: none;
    border: 0;
    transform: none;
    overflow-anchor: auto;
  }
  .fallback {
    color: var(--accent);
  }
  /* On a desktop window the section draws no box: its header is held at the top of the panel, opaque
     and the panel's full width, and the rest scrolls behind it with the lists (decision 201). */
  .selected {
    display: contents;
  }
  .head {
    position: sticky;
    top: -12px; /* the panel's top edge, above its padding */
    z-index: 1;
    margin: -12px -16px 0;
    padding: 12px 16px 6px;
    background: var(--surface-opaque); /* the panel's colour over the page, without its transparency */
    border-bottom: 1px solid var(--line);
  }
  :global(html[data-phone]) .head {
    display: contents;
  }
  /* A control focused, or a target scrolled into view, lands below the header, its focus ring too
     (--head, on a desktop window the header's height and the ring's 2 px drawn outside a control,
     focus.css). A margin on everything in the column, not a padding on the panel, so the header's
     own buttons, always in view, never scroll the panel when focused. */
  .panel :global(*) {
    scroll-margin-top: var(--head, 0px);
  }
  .head,
  .head :global(*) {
    scroll-margin-top: 0;
  }
  /* A soft fade at the bottom edge of the phone's section while more of it is below (decision 148).
     The scroll timeline sets its height, and is inactive when nothing overflows, leaving it at 0. The
     second mask layer keeps the bottom border. A control focused with the keyboard is never faded. */
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
  /* 40% of the sheet, fixed for the double tap (decision 171). */
  :global(html[data-phone]) .selected {
    display: block;
    height: calc(var(--sheet) * 0.4);
    overflow-y: auto;
    border-bottom: 1px solid var(--line);
    mask:
      linear-gradient(#000 calc(100% - var(--fade)), transparent),
      linear-gradient(#000 0 0) bottom / 100% 1px no-repeat;
    animation: fade-hint linear both;
    animation-timeline: scroll(self);
    animation-range: calc(100% - 24px) 100%; /* it shrinks over the last 24px of scrolling */
  }
  :global(html[data-phone]) .selected:has(:focus-visible) {
    animation: none;
  }
  /* On a phone the name, the type line and the actions are one block of fixed height above the
     section, held at the top of the panel while the rest scrolls under it; nothing below moves
     between two taps (the name and type are one line each, cut when long). */
  .held {
    box-sizing: border-box;
    height: var(--held);
    position: sticky;
    top: 0;
    z-index: 1;
    padding-top: 4px;
    background: var(--surface-opaque);
    border-bottom: 1px solid var(--line);
  }
  /* Its height is fixed, so the sheet's peek height (--held, Sheet.svelte) is known before anything
     is drawn and the scene never moves when the panel appears: the name and the type line are one
     line each at fixed line heights, cut when long, and the actions are one row of 44 px buttons. */
  .name {
    height: 48px;
    overflow: hidden;
  }
  .name :global(h2) {
    line-height: 28px;
  }
  .name :global(p) {
    margin: 0;
    line-height: 20px;
  }
  .actions {
    display: flex;
    gap: 4px;
    padding: 6px 0;
  }
  /* At the side the sheet is the screen's full height and never peeks, and that height is short:
     only the actions are held, as before, and the name scrolls away with the rest. */
  :global(html[data-side]) .held {
    display: contents;
  }
  :global(html[data-side]) .panel {
    scroll-padding-top: 64px;
  }
  :global(html[data-side]) .actions {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--surface-opaque);
    border-bottom: 1px solid var(--line);
  }
  .actions button {
    flex: auto;
    min-width: 44px;
    min-height: 44px;
    padding: 0 6px;
  }
  .actions .flag {
    flex: none;
    font-size: var(--fs-lg);
  }
  /* On a phone Prev and Next sit in the one row as before, without the caption. */
  .actions .path-step {
    display: contents;
  }
  .actions .badge {
    flex: auto;
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
  }
  /* On a desktop window the actions wrap: Make Focus, Pin and Read first, then the Your Path pair and
     the quiet correction link. */
  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  .path-step {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  /* One whole-pixel height for every control in the row, the Focus badge too: swapping the badge for
     Make Focus between the two clicks of a double click must not change the header's height. */
  .buttons button,
  .buttons .badge {
    box-sizing: border-box;
    height: 28px;
  }
  .buttons .path-step button {
    padding: 2px 8px;
    font-size: var(--fs-sm);
  }
  .caption {
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .buttons .quiet {
    margin-left: auto;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  h3 {
    margin: 14px 0 4px;
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
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
    background: var(--control);
  }
  .item .muted {
    font-size: var(--fs-sm);
  }
  /* The text is dimmed by its colour and not its opacity, so a bold name, in its type's colour (the
     graph's disc colours), is not dimmed with it. */
  .jump {
    all: unset;
    cursor: pointer;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .verse-text {
    margin: 0 0 8px 4px;
    color: var(--text-soft);
  }
  .verse-full {
    margin: 6px 0;
  }
  /* On a phone a long Verse scrolls in its own box, so the shared Verses below it stay in reach. */
  :global(html[data-phone]) .verse-full {
    max-height: 11.6em;
    overflow-y: auto;
  }
  /* A short filtered list leaves the column shorter than the panel, so a selection that grows what lies
     above it could not be held where it was clicked (decision 201); a screen of room below lets it.
     The Clear button is shown exactly while a list has an active query (a non-blank query in a box
     that is shown), so it is the test. */
  :global(html:not([data-phone])) .panel:has(.filter .clear) {
    padding-bottom: 100vh;
  }
  /* A long list's filter box: the clear button sits in its right end; the count for screen readers
     is out of sight. */
  .filter {
    position: relative;
    margin: 2px 0 6px;
  }
  /* A magnifier at the left end and a placeholder that says what it filters, so the box never reads
     as an empty bar. */
  .filter .icon {
    position: absolute;
    top: 50%;
    left: 8px;
    width: 13px;
    height: 13px;
    transform: translateY(-50%);
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    pointer-events: none;
  }
  .filter input::placeholder {
    color: var(--muted);
    opacity: 1;
  }
  .filter input {
    box-sizing: border-box;
    width: 100%;
    padding: 3px 56px 3px 27px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--field);
    color: inherit;
    font: inherit;
  }
  .filter input::-webkit-search-cancel-button {
    display: none; /* the Clear button is the one control, in every browser */
  }
  .filter .clear {
    position: absolute;
    top: 50%;
    right: 4px;
    transform: translateY(-50%);
    padding: 1px 8px;
    border-radius: 999px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  :global(html[data-phone]) .filter input {
    font-size: var(--fs-lg); /* under 16px iOS zooms the page when the box is focused */
  }
  .more {
    margin: 4px 0;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .more[aria-expanded="true"] {
    color: var(--accent);
  }
  .muted {
    color: var(--muted);
  }
  /* One line, cut with an ellipsis. */
  .line {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* At most two lines for the words, then the correction link. On a phone the line keeps that height
     with or without a Relationship, and the correction link is 44 px tall. */
  :global(html[data-phone]) .relationship {
    height: calc(2.9em + 44px);
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
    font-size: var(--fs-sm);
  }
  li > .fix:hover,
  li > .fix:focus-visible {
    color: var(--accent);
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
    color: var(--accent);
  }
  .fix {
    padding: 0;
    border: 0;
    background: none;
    font-size: var(--fs-xs);
    color: var(--muted);
    text-decoration: underline;
  }
  .facts {
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }
  .note {
    font-size: var(--fs-sm);
    color: var(--text-soft);
  }
  a {
    color: var(--accent);
  }
  .entry p {
    min-height: 0;
  }
  button {
    font: inherit;
    color: inherit;
    background: var(--control);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 3px 10px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  /* Make Focus is the primary action: filled with the accent. The rest are secondary. */
  button.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--surface-opaque);
    font-weight: 600;
  }
  button.primary:hover:not(:disabled) {
    background: #ffe0a3;
  }
  /* Suggest a correction is a quiet text link on a desktop window; on a phone it is the flag. */
  .buttons button.quiet {
    padding: 3px 2px;
    border-color: transparent;
    background: none;
    font-size: var(--fs-sm);
    color: var(--muted);
    text-decoration: underline;
  }
  /* The Focus itself: a badge where Make Focus would be. */
  .badge {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 3px 10px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: var(--accent);
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
