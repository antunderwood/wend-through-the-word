<script lang="ts">
  import { onMount, tick } from "svelte";
  import { read, START, write } from "./address";
  import { correctionLink, type Request } from "./correction";
  import { createData, fetchJSON, type Data } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import PathBar from "./PathBar.svelte";
  import Reader from "./Reader.svelte";
  import NoteBox from "./NoteBox.svelte";
  import { notesMarkdown } from "./notes";
  import { afterClear, hiddenNote, initialState, passes, reduce, relation, scene, typeOf, TYPES, TYPE_NAME, TYPE_PLURAL, type Action, type Evidence, type Id, type NodeType, type Scene, type SceneNode, type View } from "./model";
  import Search from "./Search.svelte";
  import { store, stored } from "./storage";

  const HINT_KEY = "wend.hintDismissed";
  const NOTES_KEY = "wend.notes";
  const JOURNEY_KEY = "wend.journey";

  const VIEW_NAME: Record<View, string> = { A: "Tilted plane", B: "Stacked discs", C: "Free orbit" };
  const VIEW_KEYS = Object.keys(VIEWS) as View[];
  const VIEW_STORE = "wend.view";

  let host: HTMLDivElement;
  let graph: Graph | undefined;
  let data = $state.raw<Data>();
  let model = $state.raw(initialState(START));
  let onScreen = $state.raw<Scene>();
  // A data file failed twice (the loader retries once): a message and a Retry, never a broken scene.
  let failure = $state<{ message: string; retry: () => void }>();
  let noWebGL = $state(false);
  let hint = $state(!stored(HINT_KEY));
  let tip = $state.raw<{ text: string; x: number; y: number } | null>(null);
  let collapsed = $state(false);
  // The nodes whose Neighbours, and whose Verses shared with the Focus, the panel lists. A click in
  // a list keeps that list, so the second click of a double click lands on the same item.
  let neighboursOf = $state(START);
  let versesOf = $state(START);
  let opened = $state<Record<string, boolean>>({}); // "owner|type" lists opened with "N more"
  let selectedBox = $state<HTMLElement>();
  // The Verse the reader panel is open at; undefined when it is closed.
  let reading = $state<Id>();
  const storedView = stored(VIEW_STORE);
  // The tilted plane unless the reader chose another view in this browser (decision 118).
  let view = $state<View>(storedView && Object.hasOwn(VIEWS, storedView) ? (storedView as View) : "A");

  function choose(v: View) {
    view = v;
    store(VIEW_STORE, v);
    graph?.setView(v); // the Focus Model state is untouched: only the view changes
  }

  // Left and Right on the picker step through the views, as a radio group does.
  async function stepView(e: KeyboardEvent) {
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    choose(VIEW_KEYS[(VIEW_KEYS.indexOf(view) + dir + VIEW_KEYS.length) % VIEW_KEYS.length]);
    await tick();
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-checked="true"]')!.focus();
  }

  const overflowType = (id: Id) => id.slice("overflow:".length) as NodeType;
  const label = (id: Id) =>
    typeOf(id) === "overflow"
      ? `+${onScreen?.nodes.find((n) => n.id === id)?.count} ${TYPE_PLURAL[overflowType(id)]}`
      : data!.label(id);

  // A name for "son of ...": without a hint or a parenthesis ("Benjamin (patriarch)" is "Benjamin").
  const plainName = (id: Id) => data!.label(id, false).replace(/\s*\(.*\)$/, "");

  function apply(a: Action, from?: "neighbours" | "verses") {
    let next = reduce(model, a, label);
    if (next.focus !== model.focus || next.path !== model.path || next.filters !== model.filters || next.pins !== model.pins) onScreen = scene(next, data!.record, data!.genderOf);
    if (a.type === "clearPath") next = afterClear(next, onScreen!);
    if (next.selected !== model.selected || next.focus !== model.focus) {
      if (from !== "neighbours") neighboursOf = next.selected;
      if (from !== "verses") {
        versesOf = next.selected;
        selectedBox?.scrollTo(0, 0); // read from the name down, not from where a long entry was left
      }
      // The open reader panel follows the Selected Verse.
      if (reading && typeOf(next.selected) === "verse") reading = next.selected;
    }
    model = next;
    graph?.render(onScreen!, model.selected);
  }

  // A record that failed to load twice: a message and a Retry.
  const loadFailed = (id: Id, e: unknown, retry: () => void) => (failure = { message: `Could not load ${label(id)}: ${(e as Error).message}`, retry });

  // The new Focus and its relatives load first; a later move wins over an earlier one still loading.
  let moves = 0;
  async function makeFocus(id: Id) {
    const refused = typeOf(id) === "overflow" ? "An Overflow Node cannot be the Focus." : data!.outside(id);
    if (refused) {
      model = { ...model, notice: refused };
      return;
    }
    const mine = ++moves;
    failure = undefined;
    try {
      await data!.loadWithKin(id);
    } catch (e) {
      if (mine === moves) loadFailed(id, e, () => makeFocus(id));
      return;
    }
    if (mine === moves) apply({ type: "focus", id });
  }

  // A pin's record must be loaded before the scene can draw its ring.
  async function pin(id: Id) {
    if (data!.outside(id)) {
      model = { ...model, notice: data!.outside(id) };
      return;
    }
    if (typeOf(id) !== "overflow") {
      failure = undefined;
      try {
        await data!.load(id);
      } catch (e) {
        loadFailed(id, e, () => pin(id));
        return;
      }
    }
    apply({ type: "pin", id });
  }

  // Opens the reader panel at the Selected Verse, or at an Entity's first Verse in Bible order.
  async function openReader() {
    if (typeOf(selected) === "verse") return (reading = selected);
    const first = (await data!.load(selected)).links.filter((l) => l.type === "verse").map((l) => l.id).sort()[0];
    if (first) reading = first;
    else model = { ...model, notice: `${label(selected)} has no linked Verses.` };
  }

  const selected = $derived(model.selected);
  const inScene = $derived(new Set(onScreen?.nodes.map((n) => n.id)));
  const selectedType = $derived(typeOf(selected) === "overflow" ? "Overflow Node" : TYPE_NAME[typeOf(selected) as NodeType]);
  // The Relationship is read from the Focus: Isaac is Abraham's son.
  const link = $derived(selected === model.focus ? undefined : data?.record(model.focus)?.links.find((l) => l.id === selected));
  const linkWords = $derived(link && relation(link, data!.genderOf, plainName(model.focus)));
  // The edges that give the words: the Co-mention for "together in N verses", else the others.
  const linkEdges = $derived(link?.edges.filter((e) => (e.edge === "CO_MENTION") === linkWords!.derived) ?? []);

  // "Theographic, CC BY-SA 4.0"; a derived link has two sources, each with its own licence.
  function credit(edges: { source?: string; licence?: string }[]) {
    const each = edges.flatMap((e) => {
      const licences = e.licence?.split("; ") ?? [];
      return e.source?.split("; ").map((s, i) => `${s}, ${licences[i]}`) ?? [];
    });
    return [...new Set(each)].join("; ");
  }
  // Evidence Verses by reference, "Gen 36:24", as the rest of the page names Verses.
  const cited = (evidence: Evidence[]) => evidence.map((v) => data!.label(v.verse_key)).join(", ");

  // An unlabelled node names itself on hover; Ring 2 also shows its way to the Focus.
  function showTip(n: SceneNode | null, x: number, y: number) {
    const named = n && ["ring2", "pinring", "path"].includes(n.role);
    const text = n?.role === "ring2" ? [n.id, n.via!, model.focus].map(label).join(" → ") : named ? label(n.id) : "";
    tip = text ? { text, x, y } : null;
  }

  // Separate from model so a list is loaded again only when its owner or the Focus changes.
  const focus = $derived(model.focus);
  // A Retry in the panel loads both lists again.
  let retries = $state(0);
  // Both are read only once data is loaded. An Overflow Node lists all the Focus's Neighbours of its type.
  const listing = $derived.by(() => {
    retries;
    return typeOf(neighboursOf) === "overflow"
      ? data!.loadWithKin(focus).then((r) => ({ r, types: [overflowType(neighboursOf)], whole: true }))
      : data!.loadWithKin(neighboursOf).then((r) => ({ r, types: TYPES, whole: false }));
  });
  const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));
  // The Verses `versesOf` shares with the Focus, then with each pin.
  const pins = $derived(model.pins);
  const sharing = $derived.by(() => {
    retries;
    return Promise.all(
      [...new Set([focus, ...pins])]
        .filter((o) => o !== versesOf && isEntity(versesOf) && isEntity(o))
        .map(async (o) => ({ with: o, verses: await data!.shared(o, versesOf) })),
    );
  });
  // The facts, corrections, and Dictionary Entry of the Selected Node, when it is an Entity.
  const details = $derived.by(() => {
    retries;
    return isEntity(selected) ? data!.details(selected) : undefined;
  });

  // Keys on the scene (or on nothing): the arrows step the selection through Ring 1 in sector order,
  // Right and Down forward, Enter makes the Selected Node the Focus, Backspace goes back to the newest
  // node on Your Path (PRD 10.4). Keys in the search box, a button, or the view picker are theirs.
  function sceneKey(e: KeyboardEvent) {
    if ((e.target !== document.body && e.target !== host) || e.altKey || e.ctrlKey || e.metaKey || !onScreen) return;
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (dir) {
      const ring = onScreen.nodes.filter((n) => n.ring1).sort((a, b) => a.ring1!.sector - b.ring1!.sector || a.ring1!.pos - b.ring1!.pos);
      const i = ring.findIndex((n) => n.id === model.selected);
      apply({ type: "select", id: ring[i < 0 ? (dir > 0 ? 0 : ring.length - 1) : (i + dir + ring.length) % ring.length].id });
    } else if (e.key === "Enter") {
      if (model.selected !== model.focus) makeFocus(model.selected);
    } else if (e.key === "Backspace") {
      if (model.path.length) makeFocus(model.path[model.path.length - 1]);
      else model = { ...model, notice: "Your Path is empty." };
    } else return;
    e.preventDefault();
  }

  // Journey notes (decision 129): a note per node ID, kept in this browser with Your Path and the Focus.
  let notes = $state.raw<Record<Id, string>>(JSON.parse(stored(NOTES_KEY) ?? "{}"));
  function keepNotes(next: Record<Id, string>) {
    notes = next;
    store(NOTES_KEY, JSON.stringify(next));
  }
  // An emptied note is removed, so its step is no longer marked.
  function writeNote(id: Id, text: string) {
    const { [id]: _, ...rest } = notes;
    keepNotes(text ? { ...rest, [id]: text } : rest);
  }
  function downloadNotes() {
    const link = (id: Id) => location.origin + location.pathname + write(initialState(id), "A");
    const text = notesMarkdown([...model.path, model.focus], notes, data!.label, (id) => TYPE_NAME[typeOf(id) as NodeType], link, new Date());
    const a = document.createElement("a");
    a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(text);
    a.download = "journey-notes.md";
    a.click();
  }

  function dismissHint() {
    hint = false;
    store(HINT_KEY, "1");
  }

  // The page opens on the address (decision 128): a missing or unknown Focus is Abraham.
  async function start() {
    failure = undefined;
    try {
      data = await createData(fetchJSON, "/data");
      const asked = read(location.search, data.known);
      // Your Path and the Focus kept in this browser, less any node a newer build no longer has.
      const kept: { focus: Id; path: Id[] } | null = JSON.parse(stored(JOURNEY_KEY) ?? "null");
      let journey = { ...initialState(kept && data.known(kept.focus) ? kept.focus : START), path: kept?.path.filter(data.known) ?? [] };
      // The address wins when it names a Focus; the kept Focus then joins Your Path, as on any move.
      if (asked.focus) journey = reduce(journey, { type: "focus", id: asked.focus }, data.label);
      const focus = journey.focus,
        pins = asked.pins ?? [];
      await Promise.all([data.loadWithKin(focus), ...pins.map(data.load)]);
      model = { ...journey, selected: asked.selected ?? focus, pins, filters: { ...model.filters, ...asked.filters }, notice: asked.notice ?? "" };
      neighboursOf = versesOf = model.selected;
      if (asked.view) view = asked.view; // the address wins over the view kept in this browser
    } catch (e) {
      failure = { message: `Could not load the data: ${(e as Error).message}`, retry: start };
      return;
    }
    onScreen = scene(model, data.record, data.genderOf);
    try {
      graph = createGraph(host, data.label, data.quote);
    } catch {
      noWebGL = true; // the panel works alone (PRD 10.2 items 8 and 9)
      return;
    }
    graph.setView(view);
    graph.onNodeClick((id) => apply({ type: "select", id }));
    graph.onNodeDoubleClick(makeFocus);
    graph.onHover(showTip);
    graph.render(onScreen, model.selected);
    // The browser tests read node positions; only their build (vite build --mode e2e) has the hook.
    if (import.meta.env.MODE === "e2e") Object.assign(window, { wendGraph: graph });
  }

  onMount(() => {
    start();
    return () => graph?.dispose();
  });

  // The address follows the page: a new Focus is a new history entry, any other change replaces it.
  let entryFocus = "";
  $effect(() => {
    if (!onScreen) return;
    const url = location.pathname + write(model, view);
    if (entryFocus && model.focus !== entryFocus) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    entryFocus = model.focus;
  });

  $effect(() => {
    if (onScreen) store(JOURNEY_KEY, JSON.stringify({ focus: model.focus, path: model.path }));
  });

  // Back and Forward make the entry's Focus the Focus again.
  function moved() {
    entryFocus = read(location.search, data!.known).focus ?? START;
    makeFocus(entryFocus);
  }

  // "Suggest a correction" (decision 131): the issue form's address, shown after a warning about
  // what a request needs. The page address in it is the shareable one.
  let asking = $state<string>();
  let warning: HTMLDialogElement;
  async function suggest(kind: Request["kind"], nodeIds: Id[], currentValue: string) {
    try {
      const pageUrl = location.origin + location.pathname + write(model, view);
      asking = correctionLink((await data!.credits()).curated_tables, { kind, nodeIds, currentValue, dataVersion: data!.version, pageUrl });
    } catch (e) {
      model = { ...model, notice: `Could not open the correction form: ${(e as Error).message}` };
      return;
    }
    await tick();
    warning.showModal();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    model = { ...model, notice: "Link copied." };
  }
</script>

<svelte:window onkeydown={sceneKey} onpopstate={moved} />
<!-- The scene takes keyboard focus so its keys work after a click on it (ARIA "application"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- The scene takes the space between the open panels. -->
<div class="stage" class:reading class:narrow={!collapsed && !noWebGL} role="application" aria-label="Graph: arrow keys select a Ring 1 node, Enter makes it the Focus, Backspace goes back" tabindex="0" bind:this={host}></div>
{#if onScreen && data}
  <Search {data} onchoose={makeFocus} />
  <!-- The chevron points the way the panel will move. -->
  <button class="chevron" hidden={noWebGL} aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
    {collapsed ? "‹" : "›"}
  </button>
  <aside id="panel" class="panel" class:collapsed class:full={noWebGL} aria-label="Selected Node">
    {#if noWebGL}
      <p class="fallback">This browser has no WebGL, so the graph is not drawn. The lists below work alone: a click selects, a double click makes the Focus.</p>
    {/if}
    <!-- Fixed height, so the Neighbour lists below never move between the two clicks of a double click. -->
    <section class="selected" bind:this={selectedBox}>
      <h2>{label(selected)}</h2>
      <p class="muted">{selectedType}{#await details then d}{#if d}, from {credit([d])}{/if}{/await}</p>
      <!-- Each item (Relationship, fact, linked Verse) ends with its source; anything else about
           that item goes after it. -->
      <p class="relationship">
        {#if link}Relationship: <b>{linkWords!.text}</b> <small class="source">{credit(linkEdges)}</small>
          {@render fix("the Relationship", "relationship", [model.focus, selected], `${plainName(selected)}: ${linkWords!.text}`)}{/if}
      </p>
      {#if data.outside(selected)}<p class="muted">{data.outside(selected)}</p>{/if}
      <button onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
      {#if model.pins.includes(selected)}
        <button onclick={() => apply({ type: "unpin", id: selected })}>Unpin</button>
      {:else}
        <button onclick={() => pin(selected)}>Pin</button>
      {/if}
      <button onclick={() => apply({ type: "step", dir: -1 })}>Prev</button>
      <button onclick={() => apply({ type: "step", dir: 1 })}>Next</button>
      <button onclick={openReader} disabled={typeOf(selected) === "overflow"}>Read</button>
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
        <NoteBox name={label(selected)} text={notes[selected] ?? ""} onnote={(t) => writeNote(selected, t)} download={downloadNotes} deleteAll={() => keepNotes({})} />
      {/if}
      {#each linkEdges.filter((e) => e.note) as e, i (i)}
        <p class="note">Note on the Relationship: {e.note} Evidence: {cited(e.evidence!)}.{@render request(e.request)}</p>
      {/each}
      {#await details then d}
        {#if d?.facts.length}
          <ul class="facts" aria-label="Facts">
            {#each d.facts as f (f.name)}
              <li><span class="muted">{f.name}</span> {f.value} <small class="source">{credit([f])}</small> {@render fix(f.name, "fact", [selected], `${f.name}: ${f.value}`)}</li>
            {/each}
          </ul>
        {/if}
        {#if d?.corrections.length}
          <ul class="facts" aria-label="Corrections">
            {#each d.corrections as c, i (i)}
              <li>Corrected after review: {c.field} ({cited(c.evidence)}). <span class="muted">{c.note}</span>{@render request(c.request)} <small class="source">{credit([c])}</small></li>
            {/each}
          </ul>
        {/if}
        {#if d?.entry}
          {@const [first, ...rest] = d.entry.text.split(/\n\s*\n\s*/)}
          {@const key = `${selected}|entry`}
          <section class="entry" aria-labelledby="entry">
            <h3 id="entry">{d.entry.source}</h3>
            {#each opened[key] ? [first, ...rest] : [first] as paragraph, i (i)}<p>{paragraph}</p>{/each}
            {#if rest.length}
              <button class="more" aria-expanded={!!opened[key]} onclick={() => (opened[key] = !opened[key])}>{opened[key] ? "Read less" : "Read more"}</button>
            {/if}
            <small class="source">{d.entry.licence}</small>
          </section>
        {/if}
      {:catch e}
        {@render failed("the details", e)}
      {/await}
    </section>
    {#await listing then list}
      <!-- An Entity's linked Verses are in Bible order (Verse Keys sort so), each with its source. -->
      {#each list.types as t (t)}
        {@const linked = t === "verse" && isEntity(list.r.id)}
        {@const found = list.r.links.filter((l) => l.type === t && l.id !== list.r.id && passes(l, model.filters))}
        {@const all = linked ? found.sort((a, b) => (a.id < b.id ? -1 : 1)) : found}
        {@const key = `${neighboursOf}|${t}`}
        {@const k = model.filters.k}
        {#if all.length}
          <h3 id="list-{t}">{TYPE_NAME[t]} ({all.length})</h3>
          <ol aria-labelledby="list-{t}">
            {#each list.whole || opened[key] ? all : all.slice(0, k) as l (l.id)}
              {@const words = relation(l, data.genderOf, plainName(list.r.id)).text}
              <li>
                {@render item(l.id, words, "neighbours")}
                {#if linked}
                  <small class="source">{credit(l.edges)}</small>
                  {@render fix(`the link to ${data.label(l.id)}`, "verse", [list.r.id, l.id], `${plainName(list.r.id)}: ${words} (${data.label(l.id)})`)}
                {/if}
              </li>
            {/each}
          </ol>
          {#if !list.whole && all.length > k}
            <button class="more" aria-expanded={!!opened[key]} onclick={() => (opened[key] = !opened[key])}>
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
  <PathBar {model} {label} {apply} {notes} />
  {#if reading}
    <div class="drawer">
      <Reader
        {data}
        at={reading}
        {selected}
        inScene={(id) => inScene.has(id)}
        onselect={(id) => apply({ type: "select", id })}
        onfocus={makeFocus}
        onmove={(id) => (reading = id)}
        onclose={() => (reading = undefined)}
      />
    </div>
  {/if}
{/if}

<!-- A click selects and a double click makes the Focus, as in the scene. -->
{#snippet item(id: Id, words: string, from: "neighbours" | "verses")}
  <button class="item" class:sel={id === selected} onclick={() => apply({ type: "select", id }, from)} ondblclick={() => makeFocus(id)}>
    {data!.label(id, false)}
    {#if words}<span class="muted">{words}</span>{/if}
  </button>
{/snippet}
<!-- A small link that opens the correction form for one item. -->
{#snippet fix(what: string, kind: Request["kind"], nodeIds: Id[], currentValue: string)}
  <button class="fix" aria-label="Suggest a correction to {what}" onclick={() => suggest(kind, nodeIds, currentValue)}>Suggest a correction</button>
{/snippet}
{#snippet request(url?: string | null)}
  {#if url}{" "}<a href={url} target="_blank" rel="noopener">Request #{url.slice(url.lastIndexOf("/") + 1)}</a>{/if}
{/snippet}
{#snippet failed(what: string, e: Error)}
  <p class="muted">Could not load {what}: {e.message} <button onclick={() => retries++}>Retry</button></p>
{/snippet}
{#if hint}
  <p class="hint">
    A click selects a node. A double click, Make Focus, or search moves the Focus.
    <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
  </p>
{/if}
{#if failure}
  <div class="failure" role="alert">
    <p>{failure.message}</p>
    <button onclick={failure.retry}>Retry</button>
  </div>
{/if}
<div class="controls">
  {#if !noWebGL}
    <div class="views" role="radiogroup" aria-label="View" tabindex="-1" onkeydown={stepView}>
      {#each VIEW_KEYS as key (key)}
        <button role="radio" aria-checked={view === key} tabindex={view === key ? 0 : -1} onclick={() => choose(key)}>{VIEW_NAME[key]}</button>
      {/each}
    </div>
  {/if}
  {#if onScreen}<button class="copy" onclick={copyLink}>Copy link</button>{/if}
</div>
<dialog class="warning" bind:this={warning} aria-labelledby="warning">
  <h2 id="warning">Suggest a correction</h2>
  <p>The form is on GitHub. A request needs at least one Evidence Verse, and is published under CC BY-SA 4.0.</p>
  <p class="muted">For readers without a GitHub account, another way to send a request is coming.</p>
  <a href={asking} target="_blank" rel="noopener" onclick={() => warning.close()}>Open the form on GitHub</a>
  <button onclick={() => warning.close()}>Cancel</button>
</dialog>
<p class="notice" role="status">{model.notice}</p>
<footer>
  <a href="/credits.html">Data: CC BY-SA 4.0, credits</a>{#if data}<span class="muted">. Data version {data.version}</span>{/if}
</footer>
{#if onScreen?.hidden}<p class="trimmed">{hiddenNote(onScreen)}</p>{/if}
{#if tip}<div class="tip" role="tooltip" style:left="{tip.x + 14}px" style:top="{tip.y + 14}px">{tip.text}</div>{/if}

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: #0d0f17;
    color: #e6e8f0;
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  /* Below the top strip of the search box and the Your Path bar, like the panel. */
  .stage {
    position: fixed;
    inset: 56px 0 0;
  }
  .stage.reading {
    left: 412px; /* the reader drawer's right edge (16 + 380) and a gap */
  }
  .stage.narrow {
    right: 340px; /* the panel's width */
  }
  .stage :global(canvas) {
    display: block;
    touch-action: none;
  }
  .controls {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }
  .views {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: #161a28;
  }
  .views button {
    border: 0;
    border-radius: 999px;
    padding: 4px 12px;
    background: none;
    color: #9aa0b4;
    font: inherit;
    cursor: pointer;
  }
  .copy {
    border-radius: 999px;
  }
  .views button[aria-checked="true"] {
    background: #2a3048;
    color: #ffd27a;
  }
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
  .panel.full {
    left: 0;
    width: auto;
    bottom: 36px; /* above the footer */
  }
  .panel.collapsed {
    transform: translateX(100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      transition: none;
    }
  }
  /* Under the search box, clear of the notes in the bottom left corner. */
  .drawer {
    position: fixed;
    top: 132px;
    left: 16px;
    bottom: 92px;
    width: 380px;
    box-sizing: border-box;
    padding: 12px 16px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-radius: 8px;
  }
  .chevron {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    font-size: 20px;
    line-height: 1;
  }
  .selected {
    height: 55%;
    overflow-y: auto;
    border-bottom: 1px solid #262a3c;
  }
  .panel h2 {
    margin: 0;
    font-size: 17px;
  }
  .panel h3 {
    margin: 14px 0 4px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9aa0b4;
  }
  .panel p {
    margin: 4px 0;
    min-height: 1.45em;
  }
  .panel ol,
  .panel ul {
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
  .panel .verse-text {
    margin: 0 0 8px 4px;
    opacity: 0.85;
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
  /* Where a fact or link came from: quiet, after the item. */
  .source {
    font-size: 11px;
    color: #7a8098;
  }
  /* Two lines whether or not there is a Relationship, so the shared Verses below never move between
     the two clicks of a double click. */
  .panel .relationship {
    min-height: 2.9em;
  }
  .fix {
    padding: 0;
    border: 0;
    background: none;
    font-size: 11px;
    color: #9aa0b4;
    text-decoration: underline;
  }
  .warning {
    max-width: 360px;
    padding: 16px 20px;
    background: #161a28;
    color: inherit;
    border: 1px solid #3a4060;
    border-radius: 8px;
  }
  .warning h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .warning a {
    margin-right: 12px;
    color: #ffd27a;
  }
  .panel .facts {
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }
  .panel .note {
    font-size: 13px;
    color: #c8cde0;
  }
  .panel a {
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
  .hint {
    position: fixed;
    left: 50%;
    top: 64px;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 8px 6px 14px;
    background: rgba(20, 23, 34, 0.92);
    border-radius: 6px;
    color: #c8cde0;
  }
  .hint button {
    margin-left: 8px;
    padding: 0 7px;
  }
  .trimmed {
    position: fixed;
    left: 16px;
    bottom: 64px; /* above the notice line */
    margin: 0;
    font-size: 12px;
    color: #9aa0b4;
  }
  .tip {
    position: fixed;
    pointer-events: none;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid #262a3c;
    border-radius: 6px;
    font-size: 12px;
  }
  .fallback {
    color: #ffd27a;
  }
  .failure {
    position: fixed;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    padding: 12px 16px;
    background: rgba(20, 23, 34, 0.96);
    border: 1px solid #3a4060;
    border-radius: 8px;
    text-align: center;
  }
  .failure p {
    margin: 0 0 8px;
  }
  .notice {
    position: fixed;
    left: 16px;
    bottom: 40px; /* above the footer */
    margin: 0;
    color: #9aa0b4;
  }
  footer {
    position: fixed;
    left: 16px;
    bottom: 12px;
    font-size: 12px;
    color: #9aa0b4;
  }
  footer a {
    color: inherit;
  }
</style>
