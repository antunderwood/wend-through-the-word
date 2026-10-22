<script lang="ts">
  import { onMount, tick } from "svelte";
  import { read, START, write } from "./address";
  import CorrectionDialog from "./CorrectionDialog.svelte";
  import { createData, fetchJSON, type Data } from "./data";
  import DetailPanel from "./DetailPanel.svelte";
  import Filters from "./Filters.svelte";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import PathBar from "./PathBar.svelte";
  import Reader from "./Reader.svelte";
  import { notesMarkdown } from "./notes";
  import { afterClear, hiddenNote, initialState, reduce, scene, typeOf, TYPE_NAME, TYPE_PLURAL, type Action, type Id, type NodeType, type Scene, type SceneNode, type State, type View } from "./model";
  import { screen } from "./screen.svelte";
  import Search from "./Search.svelte";
  import Sheet from "./Sheet.svelte";
  import Tour from "./Tour.svelte";
  import { TOUR_START, type TourPage } from "./tour";
  import { keepNotes, keepPath, keptNotes, keptPath, restore, withNote, type Notes } from "./session";
  import { store, stored } from "./storage";

  const HINT_KEY = "wend.hintDismissed";

  const VIEW_NAME: Record<View, string> = { A: "Tilted plane", B: "Stacked discs", C: "Free orbit" };
  const VIEW_KEYS = Object.keys(VIEWS) as View[];
  const VIEW_STORE = "wend.view";

  let host: HTMLDivElement;
  let graph = $state.raw<Graph>();
  let data = $state.raw<Data>();
  let model = $state.raw(initialState(START));
  let onScreen = $state.raw<Scene>();
  // A data file failed twice (the loader retries once): a message and a Retry, never a broken scene.
  let failure = $state<{ message: string; retry: () => void }>();
  let noWebGL = $state(false);
  let hint = $state(!stored(HINT_KEY));
  let tip = $state.raw<{ text: string; x: number; y: number } | null>(null);
  let collapsed = $state(false);
  // The height the bottom sheet takes on a phone, open or closed: the scene's centre sits above it.
  let sheetShown = $state(0);
  $effect(() => graph?.setOffset(screen.phone ? sheetShown : 0));
  // The Verse the reader panel is open at; undefined when it is closed. It opens whenever a Verse
  // becomes the Focus or the address names a Verse Focus; closing it lasts until then (decisions 140, 147).
  let reading = $state<Id>();
  const storedView = stored(VIEW_STORE);
  // The tilted plane unless the reader chose another view in this browser (decision 118).
  let view = $state<View>(storedView && Object.hasOwn(VIEWS, storedView) ? (storedView as View) : "A");
  // Animation turned off in the filter panel is kept in this browser (PRD 10.2 rule 6).
  const MOTION_STORE = "wend.motion";
  let motion = $state(stored(MOTION_STORE) !== "off");
  let correction = $state<CorrectionDialog>();

  function setMotion(on: boolean) {
    motion = on;
    store(MOTION_STORE, on ? "on" : "off");
    graph?.setMotion(on);
  }

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

  const label = (id: Id) =>
    typeOf(id) === "overflow"
      ? `+${onScreen?.nodes.find((n) => n.id === id)?.count} ${TYPE_PLURAL[id.slice("overflow:".length) as NodeType]}`
      : data!.label(id);

  // The page address to share (Copy link, the notes download, a correction): it names the Focus.
  const shareLink = (s: State, v: View) => location.origin + location.pathname + write(s, v, data!.osis, true);

  // A deploy while the page is open changes the data version (decision 159). The notice says so,
  // and keeps saying so with the notice of the action that loaded the new version.
  let version = $state("");
  let updated = "";
  function update(v: string) {
    version = v;
    updated = `The data was updated to version ${v}.`;
    model = { ...model, notice: updated };
  }

  function apply(a: Action) {
    let next = reduce(model, a, label);
    if (updated && model.notice === updated) next = { ...next, notice: `${updated} ${next.notice}`.trim() };
    updated = "";
    if (next.focus !== model.focus || next.path !== model.path || next.filters !== model.filters || next.pins !== model.pins) onScreen = scene(next, data!.record, data!.genderOf, data!.bookOf);
    if (a.type === "clearPath") next = afterClear(next, onScreen!);
    // The open reader panel follows the Selected Verse.
    if (reading && next.selected !== model.selected && typeOf(next.selected) === "verse") reading = next.selected;
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
    if (mine !== moves) return;
    apply({ type: "focus", id });
    if (typeOf(id) === "verse") reading = id;
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

  // An unlabelled node names itself on hover; Ring 2 also shows its way to the Focus.
  function showTip(n: SceneNode | null, x: number, y: number) {
    const named = n && ["ring2", "pinring", "path"].includes(n.role);
    const text = n?.role === "ring2" ? [n.id, n.via!, model.focus].map(label).join(" → ") : named ? label(n.id) : "";
    tip = text ? { text, x, y } : null;
  }

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
  let notes = $state.raw<Notes>(keptNotes());
  function setNotes(next: Notes) {
    notes = next;
    if (!touring) keepNotes(next);
  }
  function downloadNotes() {
    const text = notesMarkdown([...model.path, model.focus], notes, data!.label, (id) => TYPE_NAME[typeOf(id) as NodeType], (id) => shareLink(initialState(id), "A"), new Date());
    const a = document.createElement("a");
    a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(text);
    a.download = "journey-notes.md";
    a.click();
  }

  function dismissHint() {
    hint = false;
    store(HINT_KEY, "1");
  }

  // The first-run tour (decision 155): offered in this browser until taken or skipped, "on" while it
  // runs. While it runs nothing is kept in this browser and the address is replaced, not pushed; when
  // it ends, the reader's state comes back and a note written in it goes unless the reader keeps it.
  const TOUR_KEY = "wend.tourOffered";
  let tour = $state<"offer" | "on">();
  const touring = $derived(tour === "on");
  let tours = $state(0); // each start draws a new tour box
  let saved: { model: State; reading?: Id; notes: Notes } | undefined;
  const tourPage: TourPage = {
    get data() {
      return data!;
    },
    get model() {
      return model;
    },
    get view() {
      return view;
    },
    get reading() {
      return reading;
    },
    get notes() {
      return notes;
    },
    apply,
    makeFocus,
    pin,
    read: openReader,
    note: (id, text) => setNotes(withNote(notes, id, text)),
  };
  // A whole new state: its Focus, kin, and pins load before it is shown.
  async function show(next: State) {
    await Promise.all([data!.loadWithKin(next.focus), ...next.pins.map(data!.load)]);
    model = next;
    onScreen = scene(next, data!.record, data!.genderOf, data!.bookOf);
    graph?.render(onScreen, next.selected);
  }
  // The tour box appears with the tour's start state, loaded first.
  async function startTour() {
    store(TOUR_KEY, "1");
    await data!.loadWithKin(TOUR_START);
    if (!touring) saved = { model, reading, notes };
    tour = "on";
    tours++;
    reading = undefined;
    collapsed = false;
    await show(initialState(TOUR_START));
  }
  async function endTour(keep: boolean) {
    if (touring) {
      if (keep) keepNotes(notes);
      else notes = saved!.notes;
      reading = saved!.reading;
      await show({ ...saved!.model, notice: "" });
      await tick(); // the address is replaced with the reader's before the tour lets go of it
    }
    store(TOUR_KEY, "1");
    tour = undefined;
  }

  // The page opens on the address (decision 128) and the session kept in this browser (decision 133).
  async function start() {
    failure = undefined;
    try {
      data = await createData(fetchJSON, "/data", update);
      version = data.version;
      const asked = await readAddress();
      const next = restore(asked, keptPath(), data.known, data.label);
      await Promise.all([data.loadWithKin(next.focus), ...next.pins.map(data.load)]);
      model = next;
      if (asked.focus && typeOf(next.focus) === "verse") reading = next.focus;
      if (asked.view) view = asked.view; // the address wins over the view kept in this browser
    } catch (e) {
      failure = { message: `Could not load the data: ${(e as Error).message}`, retry: start };
      return;
    }
    onScreen = scene(model, data.record, data.genderOf, data.bookOf);
    try {
      graph = createGraph(host, data.label, data.quote);
    } catch {
      noWebGL = true; // the panel works alone (PRD 10.2 items 8 and 9)
      return;
    }
    graph.setView(view);
    graph.setMotion(motion);
    graph.onNodeClick((id) => apply({ type: "select", id }));
    graph.onNodeDoubleClick(makeFocus);
    graph.onHover(showTip);
    graph.render(onScreen, model.selected);
    if (!stored(TOUR_KEY)) tour = "offer";
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
    const url = location.pathname + write(model, view, data!.osis);
    if (entryFocus && model.focus !== entryFocus && !touring) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    entryFocus = model.focus;
  });

  $effect(() => {
    if (onScreen && !touring) keepPath(model);
  });

  const readAddress = () => read(location.search, data!.exists, data!.builtBooks.map((b) => b.osis), data!.verseKey);

  // Back and Forward make the entry's Focus the Focus again.
  async function moved() {
    entryFocus = (await readAddress()).focus ?? START;
    makeFocus(entryFocus);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink(model, view));
    model = { ...model, notice: "Link copied." };
  }
</script>

<svelte:window onkeydown={sceneKey} onpopstate={moved} />
<!-- The scene takes keyboard focus so its keys work after a click on it (ARIA "application"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- The scene takes the space between the open panels. -->
<div class="stage" data-tour="scene" class:reading class:narrow={!collapsed && !noWebGL} role="application" aria-label="Graph: arrow keys select a Ring 1 node, Enter makes it the Focus, Backspace goes back" tabindex="0" bind:this={host}></div>
{#if onScreen && data}
  <Search {data} onchoose={makeFocus} />
  {#snippet details()}
    <DetailPanel
      data={data!}
      {model}
      {label}
      {apply}
      {makeFocus}
      {pin}
      onread={openReader}
      suggest={(kind, nodeIds, currentValue) => correction?.suggest(kind, nodeIds, currentValue)}
      {notes}
      onnote={(id, text) => setNotes(withNote(notes, id, text))}
      download={downloadNotes}
      deleteAll={() => setNotes({})}
      {noWebGL}
      {collapsed}
      reading={!!reading}
    />
  {/snippet}
  <!-- On a phone the panel is a tab of the bottom sheet; elsewhere it is beside the scene. -->
  {#if screen.phone}
    <Sheet tabs={[{ id: "details", name: "Details", body: details }]} bind:collapsed bind:shown={sheetShown} />
  {:else}
    <!-- The chevron points the way the panel will move. -->
    <button class="chevron" hidden={noWebGL} aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
      {collapsed ? "‹" : "›"}
    </button>
    {@render details()}
  {/if}
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
  <CorrectionDialog bind:this={correction} {data} pageUrl={() => shareLink(model, view)} onfail={(notice) => (model = { ...model, notice })} />
  {#if tour}
    {#key tours}<Tour offer={tour === "offer"} page={tourPage} onstart={startTour} onend={endTour} />{/key}
  {/if}
{/if}
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
  {#if onScreen && data}
    <button class="pill" popovertarget="filters">Filters</button>
    <Filters
      filters={model.filters}
      entityFocus={!["verse", "overflow"].includes(typeOf(model.focus))}
      books={data.builtBooks}
      {motion}
      set={(key, value) => apply({ type: "setFilter", key, value })}
      {setMotion}
    />
    <button class="pill" onclick={copyLink}>Copy link</button>
  {/if}
</div>
<p class="notice" role="status">{model.notice}</p>
<footer>
  {#if onScreen && !noWebGL}<button class="link" onclick={startTour}>Help: take the tour</button><span class="muted">. </span>{/if}
  <a href="/credits.html">About and credits</a><span class="muted">. Data: CC BY-SA 4.0{#if data}. Data version {version}{/if}</span>
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
  /* On a phone the scene is the whole width below the Your Path bar; the bottom sheet lies over it,
     and the camera's view offset keeps the centre above the sheet. */
  :global(html[data-phone]) .stage {
    top: 64px;
    left: 0;
    right: 0;
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
  .pill {
    border-radius: 999px;
  }
  .views button[aria-checked="true"] {
    background: #2a3048;
    color: #ffd27a;
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
  /* On a phone the notes, the controls, and the footer float above the bottom sheet. */
  :global(html[data-phone]) .trimmed {
    bottom: calc(var(--sheet-shown) + 64px);
  }
  :global(html[data-phone]) .notice {
    bottom: calc(var(--sheet-shown) + 40px);
  }
  :global(html[data-phone]) footer {
    bottom: calc(var(--sheet-shown) + 12px);
  }
  :global(html[data-phone]) .controls {
    bottom: calc(var(--sheet-shown) + 16px);
  }
  .muted {
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
  footer a,
  footer .link {
    color: inherit;
  }
  footer .link {
    padding: 0;
    border: 0;
    background: none;
    text-decoration: underline;
  }
</style>
