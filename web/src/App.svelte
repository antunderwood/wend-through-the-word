<script lang="ts">
  import { onMount, tick } from "svelte";
  import { read, START, write } from "./address";
  import CorrectionDialog from "./CorrectionDialog.svelte";
  import { createData, fetchJSON, type Data } from "./data";
  import DetailPanel from "./DetailPanel.svelte";
  import Filters, { FILTERS_ID } from "./Filters.svelte";
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
  // On a phone, the bottom sheet open at nearly the whole screen rather than half (dragged there).
  let sheetFull = $state(false);
  // The px the sheet covers on a phone, open or closed, at the bottom or (at the side) the right: the
  // scene's centre sits in the space above it, or left of it.
  let sheetCovered = $state(0);
  $effect(() => graph?.setOffset(screen.phone ? sheetCovered : 0, screen.side ? "right" : "bottom"));
  // Without WebGL there is no scene on a phone: the sheet takes the screen below where the scene
  // would start and the column of controls, with a gap above, below, and between them.
  let dockHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty(
      "--sheet",
      noWebGL && screen.phone && !screen.side ? `calc(100dvh - var(--keyboard, 0px) - var(--bar) - ${dockHeight}px - 2 * var(--edge))` : "",
    );
  });
  // On a phone a notice shows for a few seconds, then fades (decision 183); the words stay for a
  // screen reader. A desktop keeps it. (The derived changes only with the words, not with every model.)
  const notice = $derived(model.notice);
  let noticeShown = $state(false);
  $effect(() => {
    if (!notice) return;
    noticeShown = true;
    const t = setTimeout(() => (noticeShown = false), 3000);
    return () => clearTimeout(t);
  });
  // The Verse the reader panel is open at; undefined when it is closed. It opens whenever a Verse
  // becomes the Focus or the address names a Verse Focus; closing it lasts until then (decisions 140, 147).
  let reading = $state<Id>();
  // The bottom sheet's open tab on a phone, kept in this browser (docs/specs/mobile.md).
  type SheetTab = "details" | "reader";
  const TAB_STORE = "wend.sheetTab";
  let sheetTab = $state<SheetTab>(stored(TAB_STORE) === "reader" ? "reader" : "details");
  function chooseTab(t: SheetTab) {
    sheetTab = t;
    if (!touring) store(TAB_STORE, t);
  }
  const storedView = stored(VIEW_STORE);
  // The tilted plane unless the reader chose another view in this browser (decision 118).
  let view = $state<View>(storedView && Object.hasOwn(VIEWS, storedView) ? (storedView as View) : "A");
  // A phone offers the tilted plane and the free orbit only. A kept or shared B shows as A there,
  // and stays B in this browser and the address, so a desktop still gets it (docs/specs/mobile.md).
  const offered = $derived(screen.phone ? VIEW_KEYS.filter((v) => v !== "B") : VIEW_KEYS);
  const viewShown = $derived(offered.includes(view) ? view : "A");
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
  }
  // The Focus Model state is untouched: only the view changes, also when the width crosses the breakpoint.
  $effect(() => {
    const v = viewShown; // read first: the effect follows it even before the scene exists
    graph?.setView(v);
  });

  // Left and Right on the picker step through the views, as a radio group does.
  async function stepView(e: KeyboardEvent) {
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    choose(offered[(offered.indexOf(viewShown) + dir + offered.length) % offered.length]);
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
  // On a phone it opens the sheet at its Reader tab.
  async function openReader() {
    const first =
      typeOf(selected) === "verse" ? selected : (await data!.load(selected)).links.filter((l) => l.type === "verse").map((l) => l.id).sort()[0];
    if (!first) return (model = { ...model, notice: `${label(selected)} has no linked Verses.` });
    reading = first;
    if (screen.phone) {
      chooseTab("reader");
      collapsed = false;
    }
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
  // it ends, the reader's state comes back (on a phone the sheet's tab too) and a note written in it
  // goes unless the reader keeps it. On a phone the sheet, open (half or full) or closed, comes back
  // too (decision 185).
  const TOUR_KEY = "wend.tourOffered";
  let tour = $state<"offer" | "on">();
  const touring = $derived(tour === "on");
  let tours = $state(0); // each start draws a new tour box
  let saved: { model: State; reading?: Id; notes: Notes; tab: SheetTab; collapsed: boolean; full: boolean } | undefined;
  const tourPage: TourPage = {
    get data() {
      return data!;
    },
    get model() {
      return model;
    },
    get view() {
      return viewShown;
    },
    get coarse() {
      return screen.coarse;
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
    nodeRect: (id) => graph?.nodeRect(id) ?? null,
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
    if (!touring) saved = { model, reading, notes, tab: sheetTab, collapsed, full: sheetFull };
    tour = "on";
    tours++;
    reading = undefined;
    collapsed = false;
    sheetFull = false;
    await show(initialState(TOUR_START));
  }
  async function endTour(keep: boolean) {
    if (touring) {
      if (keep) keepNotes(notes);
      else notes = saved!.notes;
      reading = saved!.reading;
      sheetTab = saved!.tab;
      collapsed = saved!.collapsed;
      sheetFull = saved!.full;
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
    graph.setView(viewShown);
    graph.setMotion(motion);
    graph.onNodeClick((id) => apply({ type: "select", id }));
    graph.onNodeDoubleClick(makeFocus);
    graph.onHover(showTip);
    graph.render(onScreen, model.selected);
    if (!stored(TOUR_KEY)) tour = "offer";
    // The browser tests read node positions and set what no control sets, such as a low node limit;
    // only their build (vite build --mode e2e) has the hooks.
    if (import.meta.env.MODE === "e2e") Object.assign(window, { wendGraph: graph, wendApply: apply });
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

  // On a phone the Filters button opens the bottom sheet at the filters in its Details tab.
  async function showFilters() {
    collapsed = false;
    chooseTab("details");
    await tick();
    document.getElementById(FILTERS_ID)!.scrollIntoView({ block: "start" });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink(model, view));
    model = { ...model, notice: "Link copied." };
  }
</script>

<svelte:window onkeydown={sceneKey} onpopstate={moved} />
{#snippet filters(inline: boolean)}
  <Filters
    filters={model.filters}
    entityFocus={!["verse", "overflow"].includes(typeOf(model.focus))}
    books={data!.builtBooks}
    {motion}
    set={(key, value) => apply({ type: "setFilter", key, value })}
    {setMotion}
    {inline}
  />
{/snippet}
<!-- The scene takes keyboard focus so its keys work after a click on it (ARIA "application"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- The scene takes the space between the open panels. -->
<div class="stage" data-tour="scene" class:reading={reading && !screen.phone} class:narrow={!collapsed && !noWebGL} role="application" aria-label="Graph: arrow keys select a Ring 1 node, Enter makes it the Focus, Backspace goes back" tabindex="0" bind:this={host}></div>
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
      controls={screen.phone ? phoneControls : undefined}
      filtersAndLinks={screen.phone ? filtersAndLinks : undefined}
    />
  {/snippet}
  <!-- On a phone the view picker, Filters, and Copy link are a row at the top of the Details tab. -->
  {#snippet phoneControls()}
    <div class="controls row">{@render controls()}</div>
  {/snippet}
  <!-- On a phone the filter panel and the footer end the Details tab, after the lists. -->
  {#snippet filtersAndLinks()}
    {@render filters(true)}
    <footer class="about">{@render about()}</footer>
  {/snippet}
  <!-- The reader closes only where it is a drawer. -->
  {#snippet read(onclose?: () => void)}
    <Reader
      data={data!}
      at={reading!}
      {selected}
      inScene={(id) => inScene.has(id)}
      onselect={(id) => apply({ type: "select", id })}
      onfocus={makeFocus}
      onmove={(id) => (reading = id)}
      {onclose}
    />
  {/snippet}
  {#snippet readerTab()}
    <div class="reader-tab">
      {#if reading}
        {@render read()}
      {:else}
        <p class="muted">Read, in Details, opens the chapter of the Selected Verse here.</p>
      {/if}
    </div>
  {/snippet}
  <!-- On a phone the panel and the reader are tabs of the bottom sheet; elsewhere the panel is
       beside the scene and the reader is a drawer. -->
  {#if screen.phone}
    <Sheet
      tabs={[
        { id: "details", name: "Details", body: details },
        { id: "reader", name: "Reader", body: readerTab },
      ]}
      bind:tab={() => sheetTab, chooseTab}
      bind:collapsed
      bind:full={sheetFull}
      bind:covered={sheetCovered}
      side={screen.side}
    />
  {:else}
    <!-- The chevron points the way the panel will move. -->
    <button class="chevron" hidden={noWebGL} aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
      {collapsed ? "‹" : "›"}
    </button>
    {@render details()}
  {/if}
  <PathBar {model} {label} {apply} {notes} />
  {#if reading && !screen.phone}
    <div class="drawer">{@render read(() => (reading = undefined))}</div>
  {/if}
  <CorrectionDialog bind:this={correction} {data} pageUrl={() => shareLink(model, view)} onfail={(notice) => (model = { ...model, notice })} />
  {#if tour}
    {#key tours}<Tour offer={tour === "offer"} page={tourPage} onstart={startTour} onend={endTour} />{/key}
  {/if}
{/if}
{#if failure}
  <div class="failure" role="alert">
    <p>{failure.message}</p>
    <button onclick={failure.retry}>Retry</button>
  </div>
{/if}
<!-- On a phone the hint, the notes, and the controls stack in one column above the bottom sheet;
     elsewhere each keeps its own place. -->
<div class="dock" bind:offsetHeight={dockHeight}>
  {#if hint}
    <!-- A coarse pointer taps: the hint names the gestures it has. -->
    <p class="hint">
      {#if screen.coarse}A tap selects a node. A double tap, Make Focus, or search moves the Focus.{:else}A click selects a node. A double click, Make Focus, or search moves the Focus.{/if}
      <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
    </p>
  {/if}
  {#if onScreen?.hidden}<p class="trimmed">{hiddenNote(onScreen)}</p>{/if}
  <p class="notice" class:faded={!noticeShown || !model.notice} role="status">{model.notice}</p>
  {#if !screen.phone}<div class="controls">{@render controls()}</div>{/if}
</div>
{#snippet controls()}
  {#if !noWebGL}
    <div class="views" role="radiogroup" aria-label="View" tabindex="-1" onkeydown={stepView}>
      {#each offered as key (key)}
        <button role="radio" aria-checked={viewShown === key} tabindex={viewShown === key ? 0 : -1} onclick={() => choose(key)}>{VIEW_NAME[key]}</button>
      {/each}
    </div>
  {/if}
  {#if onScreen && data}
    <!-- On a phone Filters and Copy link are icons with the same accessible names, so the row fits
         a 320 px screen. -->
    {#if screen.phone}
      <button class="pill icon" aria-label="Filters" title="Filters" onclick={showFilters}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" /><circle cx="15" cy="17" r="2.5" /></svg>
      </button>
      <button class="pill icon" aria-label="Copy link" title="Copy link" onclick={copyLink}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
      </button>
    {:else}
      <button class="pill" popovertarget={FILTERS_ID}>Filters</button>
      {@render filters(false)}
      <button class="pill" onclick={copyLink}>Copy link</button>
    {/if}
  {/if}
{/snippet}
<!-- On a phone the footer is the end of the Details tab. -->
{#if !screen.phone}<footer>{@render about()}</footer>{/if}
{#snippet about()}
  {#if onScreen && !noWebGL}<button class="link" onclick={startTour}>Help: take the tour</button><span class="muted">. </span>{/if}
  <a href="/credits.html">About and credits</a><span class="muted">. Data: CC BY-SA 4.0{#if data}. Data version {version}{/if}</span>
{/snippet}
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
  /* A phone browser zooms in on a field whose text is under 16 px, so on a phone every field is
     16 px (decision 182); pinch zoom of the page stays available. */
  :global(html[data-phone] :is(input, textarea, select)) {
    font-size: 16px;
  }
  /* Sizes the phone layout's parts share: the gap at the screen's edges, and the height of the slim
     top bar of Your Path and the search icon (decision 183), above the scene. */
  :global(html) {
    --edge: 8px;
    --bar: 40px;
  }
  /* Below the top strip of the search box and the Your Path bar, like the panel. */
  .stage {
    position: fixed;
    inset: 56px 0 0;
    touch-action: none; /* a touch on the scene or a name moves the camera, never the page */
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
    top: var(--bar);
    left: 0;
    right: 0;
  }
  .stage :global(canvas) {
    display: block;
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
  .reader-tab {
    height: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
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
  .dock {
    display: contents;
  }
  /* On a phone the hint, the notes, and the notice are one column above the bottom sheet, or left of
     it at the side; the column itself lets a touch through to the scene, and so does the notice. */
  :global(html[data-phone]) .dock {
    position: fixed;
    left: var(--edge);
    right: var(--edge);
    bottom: calc(var(--sheet-covered) + var(--edge));
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    pointer-events: none;
  }
  :global(html[data-side]) .dock {
    right: calc(var(--sheet-covered) + var(--edge));
    bottom: var(--edge);
  }
  :global(html[data-phone]) .dock > * {
    position: static;
    transform: none;
    pointer-events: auto;
  }
  :global(html[data-phone]) .notice {
    pointer-events: none;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(20, 23, 34, 0.92);
    color: #c8cde0;
    transition: opacity 0.5s;
  }
  /* Faded, it stays in the page for a screen reader, and lets a touch through. */
  :global(html[data-phone]) .notice.faded {
    opacity: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .notice {
      transition: none;
    }
  }
  /* The row at the top of the Details tab: the view picker, then the icons at the end. */
  .controls.row {
    position: static;
    transform: none;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }
  .controls.row .views {
    margin-right: auto;
  }
  .icon {
    display: grid;
    place-items: center;
    padding: 0;
  }
  .icon svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  /* Large enough to tap. */
  :global(html[data-phone]) .controls button,
  :global(html[data-phone]) .hint button {
    min-height: 44px;
    min-width: 44px;
  }
  :global(html[data-phone]) .views button {
    padding: 4px 8px;
  }
  :global(html[data-phone]) .hint {
    display: flex;
    align-items: center;
    padding: 0 0 0 12px;
  }
  /* The footer at the end of the Details tab: its links are large enough to tap. */
  footer.about {
    position: static;
    margin: 14px 0 8px;
    line-height: 44px;
  }
  footer.about a {
    display: inline-block;
    min-height: 44px;
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
