<script lang="ts">
  // The splash on a first visit (decision 202): a modal dialog over the app, named by its title, with
  // the site icon's graph drawn large and the page's description. It opens from the page's own code,
  // so it shows while the data loads behind it. The browser's modal dialog makes the app behind it
  // inert and takes focus to the first button; a tap outside does nothing. Props only; App keeps the
  // remembered flag and moves focus to the graph when it closes.
  import { onMount } from "svelte";
  import { SPLASH } from "./splash";

  let { onclose }: { onclose: () => void } = $props();
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

  // Escape closes it wherever focus is (after a tap on the backdrop, on the inert page). The browser
  // lets Tab leave a modal dialog for its own toolbar; here Tab wraps round its buttons.
  function key(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key !== "Tab") return;
    e.preventDefault();
    const buttons = [...dialog.querySelectorAll("button")],
      at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(Math.max(at, 0) + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
  }

  // The icon's Neighbours (web/public/icon.svg), in the type colours the graph draws them in.
  const NEIGHBOURS = [
    [32, 12, "#6cc4a1"],
    [51, 25.8, "#e6b85c"],
    [43.8, 48.2, "#b48ee0"],
    [20.2, 48.2, "#e0869b"],
    [13, 25.8, "#a9b1c6"],
  ] as const;
</script>

<svelte:window onkeydown={key} />
<dialog class="splash" bind:this={dialog} aria-labelledby="splash-title" aria-describedby="splash-text" onclose={close}>
  <!-- The idea at a glance: a Focus and its Neighbours, joined by lines. The description carries its meaning. -->
  <svg viewBox="5 4 54 52" aria-hidden="true">
    {#each NEIGHBOURS as [x, y]}<path d="M32 32L{x} {y}" />{/each}
    {#each NEIGHBOURS as [x, y, fill], i}<circle cx={x} cy={y} r="6" {fill} style:--i={i + 1} />{/each}
    <circle cx="32" cy="32" r="9" fill="#6fa8dc" style:--i={0} />
  </svg>
  <div class="words">
    <h2 id="splash-title">{SPLASH.title}</h2>
    <p id="splash-text">{SPLASH.description}</p>
    <!-- One row of buttons: Start exploring first, so it takes focus when the splash opens. -->
    <div class="buttons">
      <button onclick={close}>{SPLASH.start}</button>
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
