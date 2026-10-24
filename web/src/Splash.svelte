<script lang="ts">
  // The splash on a first visit (decision 202): a modal dialog over the app, named by its title, with
  // the site icon's graph drawn large and the page's description. It opens from the page's own code,
  // so it shows while the data loads behind it. The browser's modal dialog makes the app behind it
  // inert and takes focus to the first button; a tap outside does nothing. Props only; App keeps the
  // remembered flag, moves focus to the graph when it closes, and starts the tour (decision 203);
  // without WebGL it passes no ontour, so there is no Take the tour.
  import { onMount } from "svelte";
  import { typeColour } from "./colours";
  import { ICON, SPLASH } from "./splash";

  let { onclose, ontour }: { onclose: () => void; ontour?: () => void } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());

  // Closed at once by a button or Escape, not only by the dialog's close event, which the browser
  // fires later (a reload in that gap lost the remembered flag, found under a full test run). The
  // event still closes it when the browser does, as a phone's back gesture does; once only.
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    dialog.close();
    onclose();
  }
  function tour() {
    close();
    ontour!();
  }

  // Escape closes it wherever focus is (after a tap on the backdrop, on the inert page). The browser
  // lets Tab leave a modal dialog for its own toolbar; here Tab wraps round its buttons. With none
  // focused (after a tap on the backdrop), Tab goes to the first and Shift+Tab to the last.
  function key(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key !== "Tab") return;
    e.preventDefault();
    const buttons = [...dialog.querySelectorAll("button")],
      n = buttons.length,
      at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[at < 0 ? (e.shiftKey ? n - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + n) % n].focus();
  }

  // The site icon's graph (splash.ts), in the type colours the graph draws its nodes in.
  const [fx, fy, ft] = ICON.focus;
</script>

<svelte:window onkeydown={key} />
<dialog class="splash" bind:this={dialog} aria-labelledby="splash-title" aria-describedby="splash-text" onclose={close}>
  <!-- The idea at a glance: a Focus and its Neighbours, joined by lines. The description carries its
       meaning. -->
  <svg viewBox="5 4 54 52" aria-hidden="true">
    {#each ICON.neighbours as [x, y]}<path d="M{fx} {fy}L{x} {y}" />{/each}
    {#each ICON.neighbours as [x, y, type], i}<circle cx={x} cy={y} r="6" fill={typeColour(type)} style:--i={i + 1} />{/each}
    <circle cx={fx} cy={fy} r="9" fill={typeColour(ft)} style:--i={0} />
  </svg>
  <div class="words">
    <h2 id="splash-title">{SPLASH.title}</h2>
    <p id="splash-text">{SPLASH.description}</p>
    <!-- One row of buttons, wrapped when narrow: Start exploring first, so it takes focus when the
         splash opens. -->
    <div class="buttons">
      <button onclick={close}>{SPLASH.start}</button>
      {#if ontour}<button onclick={tour}>{SPLASH.tour}</button>{/if}
    </div>
  </div>
</dialog>

<style>
  .splash {
    box-sizing: border-box;
    width: min(420px, 100vw - 32px);
    max-height: calc(100dvh - 16px);
    padding: 20px;
    background: #161a28;
    color: inherit;
    border: 1px solid #3a4060;
    border-radius: 8px;
    text-align: center;
  }
  .splash::backdrop {
    background: rgba(13, 15, 23, 0.75);
  }
  svg {
    display: block;
    width: 160px;
    margin: 0 auto 8px;
  }
  path {
    stroke: #c8cde0;
    stroke-opacity: 0.55;
    stroke-width: 2.5;
  }
  /* The discs fade in one after another, the Focus first; still under reduced motion. */
  circle {
    animation: appear 0.5s ease-out backwards;
    animation-delay: calc(var(--i) * 0.12s);
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    circle {
      animation: none;
    }
  }
  h2 {
    margin: 0 0 8px;
    font-size: 22px;
    color: #ffd27a;
  }
  p {
    margin: 0 0 16px;
    font-size: 15px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  button {
    min-height: 44px;
    padding: 0 20px;
    font: inherit;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
    cursor: pointer;
  }
  /* A short window (a phone on its side): the graphic beside the words, so it fits without scrolling. */
  @media (max-height: 480px) {
    .splash {
      align-items: center;
      gap: 20px;
      width: min(560px, 100vw - 32px);
      padding: 16px 20px;
      text-align: left;
    }
    .splash[open] {
      display: flex;
    }
    svg {
      flex: none;
      width: 120px;
      margin: 0;
    }
    .buttons {
      justify-content: flex-start;
    }
  }
</style>
