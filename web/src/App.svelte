<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { read, START, write } from "./address";
  import CorrectionDialog from "./CorrectionDialog.svelte";
  import { createData, fetchJSON, type Data } from "./data";
  import DetailPanel from "./DetailPanel.svelte";
  import Filters, { FILTERS_ID } from "./Filters.svelte";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import Hud from "./Hud.svelte";
  import { keepInfoMode, keptInfoMode, type InfoMode } from "./hud";
  import Legend, { LEGEND_ID } from "./Legend.svelte";
  import { fitPanelWidth, keepPanelWidth, keptPanelWidth, PANEL_MAX, PANEL_MIN, PANEL_W } from "./panel";
  import PathBar from "./PathBar.svelte";
  import Reader from "./Reader.svelte";
  import { notesMarkdown } from "./notes";
  import { afterClear, hiddenNote, initialState, overflowText, reduce, scene, typeOf, TYPE_NAME, type Action, type Id, type NodeType, type Scene, type SceneNode, type State, type View } from "./model";
  import { screen } from "./screen.svelte";
  import Search from "./Search.svelte";
  import Sheet from "./Sheet.svelte";
  import Splash from "./Splash.svelte";
  import { SPLASH_KEY } from "./splash";
  import Tour from "./Tour.svelte";
  import { TOUR_START, type TourPage } from "./tour";
  import { followNotes, keepNotes, keepPath, keptNotes, keptPath, restore, withNote, type Notes } from "./session";
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
  // The splash on a first visit in this browser (decision 203), and again from the Welcome link
  // (decision 204); the hint waits until it closes, and while a tour is asked for or runs.
  let splash = $state(!stored(SPLASH_KEY));
  let tip = $state.raw<{ text: string; x: number; y: number } | null>(null);
  let collapsed = $state(false);
  // The Selected Node shows in the side panel or on the HUD over the scene, as the reader last chose
  // in this browser. On an upright phone the HUD takes the place of the sheet's peek: it is docked
  // above the closed sheet, and the sheet opens to half or full only. A phone on its side keeps the
  // sheet; a tour and no WebGL use the panel.
  let infoMode = $state<InfoMode>(keptInfoMode());
  function setInfoMode(mode: InfoMode) {
    infoMode = mode;
    keepInfoMode(mode);
    if (mode === "panel") collapsed = false;
    if (mode === "panel" && screen.phone) sheetPeek = true;
    if (mode === "hud" && screen.phone) collapsed = true; // closes the sheet, to show the HUD
  }
  // On a phone, the bottom sheet open at nearly the whole screen rather than half (dragged there).
  let sheetFull = $state(false);
  // On a phone the sheet opens low, at its peek height: the Selected Node's name and actions only
  // (owner, 2026-11-06). Read, Filters and a tab tap open it to half.
  let sheetPeek = $state(true);
  // Opens the phone's sheet to at least half, for something in it to read.
  function openSheet() {
    collapsed = false;
    sheetPeek = false;
  }
  // The px the sheet covers on a phone, open or closed, at the bottom or (at the side) the right: the
  // scene's centre sits in the space above it, or left of it.
  let sheetCovered = $state(0);
  $effect(() => graph?.setOffset(screen.phone ? sheetCovered + (hudDocked ? hudPx + 8 : 0) : 0, screen.side ? "right" : "bottom"));
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
  // The detail panel's width as the reader dragged it (decision 225), kept in this browser; null is
  // the default. The panel takes it fitted to the window, so the scene keeps some room.
  let panelPick = $state<number | null>(keptPanelWidth());
  let windowW = $state(innerWidth);
  const panelW = $derived(panelPick === null ? null : fitPanelWidth(panelPick, windowW, !!reading));
  // A drag on the panel's left edge sizes it; arrow keys there do the same by 16 px (with Shift, 64),
  // and a double click goes back to the default width.
  function sizePanel(e: PointerEvent) {
    if (e.button !== 0) return;
    const start = panelW ?? PANEL_W,
      from = e.clientX,
      el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => (panelPick = fitPanelWidth(start + from - m.clientX, windowW, !!reading));
    const end = () => {
      el.removeEventListener("pointermove", move);
      keepPanelWidth(panelPick);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end, { once: true });
    el.addEventListener("pointercancel", end, { once: true });
    e.preventDefault();
  }
  function nudgePanel(e: KeyboardEvent) {
    const by = e.shiftKey ? 64 : 16;
    const d = { ArrowLeft: by, ArrowRight: -by }[e.key];
    if (!d) return;
    panelPick = fitPanelWidth((panelW ?? PANEL_W) + d, windowW, !!reading);
    keepPanelWidth(panelPick);
    e.preventDefault();
  }
  function resetPanel() {
    panelPick = null;
    keepPanelWidth(null);
  }
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
      ? overflowText(onScreen?.nodes.find((n) => n.id === id)?.count ?? 0, id.slice("overflow:".length) as NodeType)
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
      openSheet();
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
  // node on Your Path (PRD 10.4). Keys in the search box, a button, the view picker, or the splash
  // are theirs.
  function sceneKey(e: KeyboardEvent) {
    if (splash || (e.target !== document.body && e.target !== host) || e.altKey || e.ctrlKey || e.metaKey || !onScreen) return;
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

  // The app behind it already shows its Focus (the address's, else Jesus Christ): closing only
  // remembers it, and hands focus to the graph. Over a tour (Welcome) the flag is already kept, and
  // nothing is written while a tour runs.
  function closeSplash() {
    splash = false;
    if (!touring) store(SPLASH_KEY, "1");
    host.focus();
  }
  // Take the tour on the splash starts it as the footer's link does; pressed before the graph is
  // drawn, once it is, or never when the page finds no WebGL. Asked for, the hint waits.
  let tourAsked = $state(false);
  function takeTour() {
    tourAsked = true;
    if (graph) startTour();
  }

  // The first-run tour (decisions 155 and 204), started from the splash or the footer's link. While
  // it runs nothing is kept in this browser and the address is replaced, not pushed; when it ends,
  // the reader's state comes back (on a phone the sheet's tab too) and a note written in it goes
  // unless the reader keeps it. On a phone the sheet, open (half or full) or closed, comes back too
  // (decision 185).
  let touring = $state(false);
  const hud = $derived(infoMode === "hud" && !(screen.phone && screen.side) && !noWebGL && !touring && !!graph);
  const phoneHud = $derived(hud && screen.phone);
  // The sheet would peek where the HUD docks, so with the HUD it closes instead; the HUD shows while
  // the sheet is closed, and the sheet open to half or full lies over the scene as before.
  $effect(() => {
    if (phoneHud && sheetPeek && !collapsed) untrack(() => (collapsed = true));
  });
  const hudDocked = $derived(phoneHud && collapsed);
  // The docked HUD's height (a fixed CSS size, read in px) and the gap above the sheet, for the camera.
  let hudPx = $state(0);
  let tours = $state(0); // each start draws a new tour box
  let saved: { model: State; reading?: Id; notes: Notes; tab: SheetTab; collapsed: boolean; full: boolean; peek: boolean } | undefined;
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
    panTo: (id, x, y, zoomOut) => graph?.panTo(id, x, y, zoomOut),
    panBack: () => graph?.panBack(),
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
    await data!.loadWithKin(TOUR_START);
    if (!touring) saved = { model, reading, notes, tab: sheetTab, collapsed, full: sheetFull, peek: sheetPeek };
    touring = true;
    tourAsked = false;
    tours++;
    reading = undefined;
    collapsed = false;
    sheetFull = false;
    sheetPeek = false;
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
      sheetPeek = saved!.peek;
      await show({ ...saved!.model, notice: "" });
      await tick(); // the address is replaced with the reader's before the tour lets go of it
    }
    touring = false;
  }

  // The page opens on the address (decision 128) and the session kept in this browser (decision 133).
  async function start() {
    failure = undefined;
    try {
      data = await createData(fetchJSON, "/data", update);
      version = data.version;
      const asked = await readAddress();
      const next = restore(asked, keptPath(), data.known, data.label, data.follow);
      const followed = followNotes(notes, data.follow); // notes on a replaced ID follow it (decision 215)
      if (JSON.stringify(followed) !== JSON.stringify(notes)) keepNotes((notes = followed));
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
      sheetPeek = false; // and on a phone the sheet takes the screen, so it does not peek
      tourAsked = false; // and there is no tour, as there is no footer link for one
      return;
    }
    graph.setView(viewShown);
    graph.setMotion(motion);
    graph.onNodeClick((id) => apply({ type: "select", id }));
    graph.onNodeDoubleClick(makeFocus);
    graph.onHover(showTip);
    graph.render(onScreen, model.selected);
    if (tourAsked) startTour();
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

  const readAddress = () => read(location.search, data!.exists, data!.builtBooks.map((b) => b.osis), data!.verseKey, data!.follow);

  // Back and Forward make the entry's Focus the Focus again.
  async function moved() {
    entryFocus = (await readAddress()).focus ?? START;
    makeFocus(entryFocus);
  }

  // On a phone the Filters button opens the bottom sheet at the filters in its Details tab.
  async function showFilters() {
    openSheet();
    chooseTab("details");
    await tick();
    document.getElementById(FILTERS_ID)!.scrollIntoView({ block: "start" });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink(model, view));
    model = { ...model, notice: "Link copied." };
  }
</script>

<svelte:window onkeydown={sceneKey} onpopstate={moved} bind:innerWidth={windowW} />
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
<!-- On a desktop window the page is a grid (decision 211): the top row of the search box, the Your
     Path bar, and the panel's chevron; under it the reader drawer, the scene, and the detail panel side
     by side; and the dock of notes, the view picker, and the footer along the bottom of the drawer and
     the scene. Each part takes its place from the grid and the sizes in tokens.css, so the scene fills
     what the others leave. On a phone the shell draws no box and each part places itself over the
     scene and the bottom sheet. -->
<div class="shell" class:grid={!screen.phone} class:wide={collapsed || noWebGL || hud} class:reading={!!reading} style:--panel-w={panelW === null ? undefined : `${panelW}px`}>
<!-- The scene takes keyboard focus so its keys work after a click on it (ARIA "application"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="stage" data-tour="scene" role="application" aria-label="Graph: arrow keys select a Ring 1 node, Enter makes it the Focus, Backspace goes back" tabindex="0" bind:this={host}></div>
<!-- In the scene's top left corner on every screen: the camera goes back to the Focus (decision 188). -->
{#if graph}
  <button class="recentre icon" data-tour="recentre" aria-label="Recentre" title="Recentre" onclick={() => graph?.recentre()}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>
  </button>
{/if}
{#if onScreen && data}
  <div class="top">
    <Search {data} onchoose={makeFocus} />
    <PathBar {model} {label} {apply} {notes} {makeFocus} />
    <!-- The chevron points the way the panel will move. -->
    {#if !screen.phone}
      <button class="chevron" hidden={noWebGL || hud} aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
        {collapsed ? "‹" : "›"}
      </button>
    {/if}
  </div>
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
      collapsed={collapsed || hud}
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
    {#if !noWebGL}<Legend inline />{/if}
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
      bind:peek={sheetPeek}
      bind:covered={sheetCovered}
      side={screen.side}
      peekable={!phoneHud}
    />
    <span class="hud-probe" aria-hidden="true" bind:offsetHeight={hudPx}></span>
    {#if hudDocked}{@render hudCard()}{/if}
  {:else}
    {@render details()}
    <!-- The panel's left edge, a handle that sizes it (decision 225). -->
    {#if !(collapsed || noWebGL || hud)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="panel-edge"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-controls="panel"
        aria-label="Resize panel"
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        aria-valuenow={panelW ?? PANEL_W}
        title="Drag to resize the panel; double click for its default width"
        onpointerdown={sizePanel}
        onkeydown={nudgePanel}
        ondblclick={resetPanel}
      ></div>
    {/if}
    {#if hud}{@render hudCard()}{/if}
  {/if}
  {#snippet hudCard()}
    <Hud
      data={data!}
      {model}
      {label}
      {apply}
      {makeFocus}
      {pin}
      onread={openReader}
      onpanel={() => setInfoMode("panel")}
      nodeRect={graph?.nodeRect}
      {motion}
      {notes}
      onnote={(id, text) => setNotes(withNote(notes, id, text))}
      download={downloadNotes}
      docked={screen.phone}
      ondetails={() => {
        chooseTab("details");
        openSheet();
      }}
    />
  {/snippet}
  {#if reading && !screen.phone}
    <div class="drawer">{@render read(() => (reading = undefined))}</div>
  {/if}
  <CorrectionDialog bind:this={correction} {data} pageUrl={() => shareLink(model, view)} onfail={(notice) => (model = { ...model, notice })} />
  {#if touring}
    {#key tours}<Tour page={tourPage} onend={endTour} />{/key}
  {/if}
{/if}
{#if failure}
  <div class="failure" role="alert">
    <p>{failure.message}</p>
    <button onclick={failure.retry}>Retry</button>
  </div>
{/if}
<!-- On a phone the hint, the notes, and the controls stack in one column above the bottom sheet (the
     footer ends the Details tab there). On a desktop window the dock is the grid's bottom row: the
     notes and the footer on the left, the controls in the middle, so neither can run into the other. -->
{#snippet hintLine()}
  {#if hint && !splash && !tourAsked && !touring}
    <!-- A coarse pointer taps: the hint names the gestures it has. -->
    <p class="hint">
      <!-- On a phone one short line, so it covers little of the scene. -->
      {#if screen.phone}A tap selects a node. A double tap makes it the Focus.{:else if screen.coarse}A tap selects a node. A double tap, Make Focus, or search moves the Focus.{:else}A click selects a node. A double click, Make Focus, or search moves the Focus.{/if}
      <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
    </p>
  {/if}
{/snippet}
<!-- On a desktop window the hint is at the top of the scene, in the middle of it. -->
{#if !screen.phone}{@render hintLine()}{/if}
<div class="dock" data-tour="dock" bind:offsetHeight={dockHeight}>
  {#if screen.phone}{@render hintLine()}{/if}
  {#if onScreen?.hidden}<p class="trimmed">{hiddenNote(onScreen)}</p>{/if}
  <p class="notice" class:faded={!noticeShown || !model.notice} role="status">{model.notice}</p>
  {#if !screen.phone}
    <div class="controls">{@render controls()}</div>
    <footer>{@render about()}</footer>
  {/if}
</div>
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
      {#if !noWebGL && !touring && !screen.side}
        <button class="pill hud-toggle" class:on={hud} aria-pressed={hud} title={hud ? "Show the Selected Node in the sheet" : "Show the Selected Node on a HUD over the graph"} onclick={() => setInfoMode(hud ? "panel" : "hud")}>HUD</button>
      {/if}
      <button class="pill icon" aria-label="Filters" title="Filters" onclick={showFilters}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" /><circle cx="15" cy="17" r="2.5" /></svg>
      </button>
      <button class="pill icon" aria-label="Copy link" title="Copy link" onclick={copyLink}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
      </button>
    {:else}
      <button class="pill" popovertarget={FILTERS_ID}>Filters</button>
      {@render filters(false)}
      {#if !noWebGL}
        <button class="pill" popovertarget={LEGEND_ID}>Key</button>
        <Legend />
      {/if}
      <button class="pill" onclick={copyLink}>Copy link</button>
      <!-- The Selected Node on a see-through HUD over the scene, in place of the side panel. -->
      {#if !noWebGL && !touring}
        <button class="pill hud-toggle" class:on={hud} aria-pressed={hud} title={hud ? "Show the Selected Node in the side panel" : "Show the Selected Node on a HUD over the graph"} onclick={() => setInfoMode(hud ? "panel" : "hud")}>HUD</button>
      {/if}
    {/if}
  {/if}
{/snippet}
{#snippet about()}
  <!-- The splash again (decision 204); a tour running stays under it. -->
  <button class="link" onclick={() => (splash = true)}>Welcome</button><span class="muted">. </span>
  {#if onScreen && !noWebGL}<button class="link" onclick={startTour}>Help: take the tour</button><span class="muted">. </span>{/if}
  <a href="/credits.html">About and credits</a><span class="muted">. Data: CC BY-SA 4.0{#if data}. Data version {version}{/if}</span>
{/snippet}
{#if splash}<Splash onclose={closeSplash} ontour={noWebGL ? undefined : takeTour} />{/if}
{#if tip}<div class="tip" role="tooltip" style:left="{tip.x + 14}px" style:top="{tip.y + 14}px">{tip.text}</div>{/if}

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
    font: var(--fs-md)/1.45 var(--font);
  }
  /* A phone browser zooms in on a field whose text is under 16 px, so on a phone every field is
     16 px (decision 182); pinch zoom of the page stays available. */
  :global(html[data-phone] :is(input, textarea, select)) {
    font-size: var(--fs-lg);
  }
  /* Sizes the phone layout's parts share: the gap at the screen's edges, and the height of the slim
     top bar of Your Path and the search icon (decision 183), above the scene. */
  :global(html) {
    --edge: 8px;
    --bar: 40px;
    /* The HUD docked above the closed sheet on an upright phone: under half the screen, so the scene
       keeps the rest, and no taller than its overview needs. */
    --hud-docked: min(44dvh, 360px);
  }
  /* Short or zoomed in: the HUD's fixed chrome is a bigger share, so it may take a little more. */
  @media (max-height: 640px) {
    :global(html) {
      --hud-docked: min(52dvh, 360px);
    }
  }
  /* What floats at the bottom of the screen (the hint, the notes) sits above the docked HUD. */
  :global(html:has(.sheet.collapsed):has(.hud.docked)) {
    --sheet-covered: calc(var(--sheet-handle) + 1px + var(--keyboard, 0px) + var(--hud-docked) + var(--edge));
  }
  .hud-probe {
    position: absolute;
    width: 0;
    height: var(--hud-docked);
    visibility: hidden;
    pointer-events: none;
  }
  /* The desktop grid (decision 211). Columns: the reader drawer (as wide as it is, none when it is
     closed), the scene, and the detail panel. Rows: the top row, the main row, and the dock, as tall
     as its notes and controls. The scene runs down behind the dock, as the dock lets a pointer
     through; the drawer and a panel without the scene stop above it. With the panel hidden, or
     without WebGL, the scene and the dock take the panel's column too ("wide"). */
  .grid {
    container: shell / inline-size;
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: [drawer-start] auto [drawer-end stage-start] minmax(0, 1fr) [stage-end panel-start] var(--panel-w) [panel-end];
    grid-template-rows: [top-start] var(--top-h) [top-end main-start] minmax(0, 1fr) [main-end dock-start] auto [dock-end];
  }
  /* On a phone each part places itself (fixed) over the scene and the bottom sheet. */
  .shell:not(.grid) {
    display: contents;
  }
  /* Parts that lie over the scene stack above it; the scene is positioned, as its names are placed
     inside it. */
  .grid > .recentre,
  .grid > .dock,
  .grid > :global(.panel) {
    z-index: 1;
  }
  .stage {
    touch-action: none; /* a touch on the scene or a name moves the camera, never the page */
  }
  .grid > .stage {
    position: relative;
    z-index: 0; /* the names' own z-index stays inside the scene */
    grid-row: main-start / dock-end;
    grid-column: stage;
    overflow: hidden;
  }
  .grid.wide > :is(.stage, .dock) {
    grid-column-end: panel-end;
  }
  /* On a phone the scene is the whole width below the Your Path bar; the bottom sheet lies over it,
     and the camera's view offset keeps the centre above the sheet. */
  :global(html[data-phone]) .stage {
    position: fixed;
    inset: var(--bar) 0 0;
    /* The names carry their own z-index; without a context of their own they lay over the HUD and the
       sheet, and read through the HUD's text. */
    z-index: 0;
  }
  .stage :global(canvas) {
    display: block;
  }
  /* One top bar (decision 212): the search field, Your Path beside it, and the panel's chevron at
     the end, with one lower edge where the panel and the scene start. The type chips and the results
     drop below it only while the search box is in use. */
  .top {
    display: contents;
  }
  .grid > .top {
    z-index: 5; /* the search results stay over the HUD (4), under the tour (10) */
    grid-row: top;
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--gutter);
    min-width: 0;
    box-sizing: border-box;
    padding: 0 var(--space-3) 0 var(--gutter);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  /* The detail panel beside the scene, from below the top row to the bottom; without WebGL it takes
     the scene's place instead, below the top bar and above the dock. */
  .grid > :global(.panel) {
    grid-row: main-start / dock-end;
    grid-column: panel;
  }
  /* The panel's left edge: a strip 8 px wide inside its border, so it never lies over the scene
     (Recentre stays clear of it in a squeezed window); lit while hovered, dragged, or focused
     (decision 225). */
  .panel-edge {
    grid-row: main-start / dock-end;
    grid-column: panel;
    justify-self: start;
    z-index: 2;
    width: 8px;
    cursor: col-resize;
    touch-action: none;
  }
  .panel-edge::after {
    content: "";
    display: block;
    width: 2px;
    height: 100%;
    margin: 0 auto;
    transition: background 0.15s;
  }
  .panel-edge:is(:hover, :active, :focus-visible)::after {
    background: var(--accent);
  }
  .panel-edge:focus-visible {
    outline: none;
  }
  .grid > :global(.panel.full) {
    grid-row: main;
    grid-column: stage-start / panel-end;
    margin-top: calc(var(--top-clear) - var(--top-h));
  }
  /* The scene's top left corner: on a desktop just below the top bar, level with the top of the
     reader drawer and right of it when it is open. The hint at the top of the scene keeps clear of
     it (decision 218), so neither moves as the hint comes and goes. */
  .recentre {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-pill);
  }
  .grid > .recentre {
    grid-row: main;
    grid-column: stage;
    align-self: start;
    justify-self: start;
    margin: var(--gutter) 0 0 var(--gutter);
  }
  /* Large enough to tap. */
  :global(html[data-coarse]) .recentre {
    width: 44px;
    height: 44px;
  }
  :global(html[data-phone]) .recentre {
    position: fixed;
    top: calc(var(--bar) + var(--edge));
    left: var(--edge);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .views {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-pill);
    background: var(--raised);
  }
  .views button {
    border: 0;
    border-radius: var(--radius-pill);
    padding: var(--space-1) var(--space-3);
    background: none;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }
  .pill {
    border-radius: var(--radius-pill);
  }
  .views button[aria-checked="true"] {
    background: var(--control-on);
    color: var(--accent);
  }
  /* Just under the top bar, left of the scene, and above the dock. */
  .drawer {
    grid-row: main;
    grid-column: drawer;
    width: var(--reader-w);
    min-height: 0;
    margin: var(--gutter) var(--gutter) var(--space-2);
    box-sizing: border-box;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  .reader-tab {
    height: 100%;
    box-sizing: border-box;
    padding: var(--space-3) var(--space-4);
  }
  .chevron {
    flex: none;
    margin-left: auto; /* at the row's end, however wide the Your Path bar is */
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--radius-pill);
    font-size: var(--fs-2xl);
    line-height: 1;
  }
  /* Lit in the HUD's own line colour while the HUD shows. */
  .hud-toggle.on {
    color: rgb(var(--hud-line));
    border-color: rgba(var(--hud-line), 0.7);
    box-shadow: 0 0 6px rgba(var(--hud-line), 0.4);
  }
  .dock {
    display: contents;
  }
  /* The dock's columns: the notes and the footer on the left, one under another, and the controls
     in the middle of the drawer and the scene. The two side columns share what is left, so a long
     footer or notice wraps rather than run under the controls; where that would leave the footer
     too narrow, the dock is one column instead, the controls above the footer. The dock itself
     lets a pointer through to the scene. */
  .grid > .dock {
    container: dock / inline-size;
    grid-row: dock;
    grid-column: drawer-start / stage-end;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: end;
    gap: var(--space-1) var(--gutter);
    padding: 0 var(--gutter) var(--space-3);
    pointer-events: none;
  }
  .grid > .dock > * {
    grid-column: 1;
    pointer-events: auto;
  }
  /* One line high even when empty, so the drawer above does not move as notices come and go. */
  .grid > .dock > .notice {
    min-height: 1lh;
  }
  .grid > .dock > .controls {
    grid-column: 2;
    grid-row: 1 / span 3;
    margin-bottom: var(--space-1);
  }
  @container dock (width < 1000px) {
    .grid > .dock > * {
      grid-column: 1 / -1;
    }
    .grid > .dock > .controls {
      grid-column: 1 / -1;
      grid-row: auto;
      margin-bottom: 0;
    }
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
    background: var(--surface);
    color: var(--text-soft);
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
  /* The row at the top of the Details tab: the view picker, then the icons at the end. It is one
     row at 320 px whatever the font: were the words wider, the view names would wrap in their
     buttons, not push an icon onto a second row and the Selected Node's actions off the sheet. */
  .controls.row {
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }
  .controls.row .views {
    min-width: 0;
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
    padding: 4px 6px;
  }
  :global(html[data-phone]) .hint {
    display: flex;
    align-items: center;
    padding: 0 0 0 12px;
  }
  /* The footer at the end of the Details tab: its links are large enough to tap. */
  footer.about {
    margin: 14px 0 8px;
    line-height: 44px;
  }
  footer.about a {
    display: inline-block;
    min-height: 44px;
  }
  .muted {
    color: var(--muted);
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
  /* At the top of the scene, in the middle of what the search box leaves of it, and with the reader
     open, of what the Recentre button leaves (decision 218). */
  .grid > .hint {
    z-index: 1;
    grid-row: main;
    grid-column: stage;
    align-self: start;
    justify-self: center;
    margin: var(--gutter) var(--gutter) 0 calc(2 * var(--gutter) + var(--search-w));
  }
  .grid.reading > .hint {
    margin-left: calc(2 * var(--gutter) + 44px); /* clear of Recentre, 44 px at the most */
  }
  /* In a narrow window there is too little room right of the search box: the hint is at the foot of
     the drawer and the scene instead, just above the dock, over the drawer if it is open. */
  @container shell (width < 1100px) {
    .grid > .hint,
    .grid.reading > .hint {
      z-index: 2;
      grid-column-start: drawer-start;
      align-self: end;
      margin: 0 var(--gutter) var(--space-2);
    }
  }
  .hint {
    margin: 0;
    padding: 6px 8px 6px 14px;
    background: var(--surface);
    border-radius: 6px;
    color: var(--text-soft);
  }
  .hint button {
    margin-left: 8px;
    padding: 0 7px;
  }
  .trimmed {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .tip {
    position: fixed;
    pointer-events: none;
    padding: 4px 8px;
    background: var(--tip-bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: var(--fs-sm);
  }
  .failure {
    position: fixed;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    padding: 12px 16px;
    background: var(--surface-strong);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    text-align: center;
  }
  .failure p {
    margin: 0 0 8px;
  }
  .notice {
    margin: 0;
    color: var(--muted);
  }
  footer {
    font-size: var(--fs-sm);
    color: var(--muted);
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
