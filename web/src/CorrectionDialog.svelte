<script lang="ts">
  // "Suggest a correction" (decision 131): the issue form's address, shown after a warning about what
  // a request needs. pageUrl() is the shareable address of what the reader sees.
  import { tick } from "svelte";
  import { correctionLink, type Request } from "./correction";
  import type { Data } from "./data";
  import type { Id } from "./model";

  let { data, pageUrl, onfail }: { data: Data; pageUrl: () => string; onfail: (message: string) => void } = $props();
  let asking = $state<string>();
  let warning: HTMLDialogElement;

  export async function suggest(kind: Request["kind"], nodeIds: Id[], currentValue: string) {
    try {
      asking = correctionLink((await data.credits()).curated_tables, { kind, nodeIds, currentValue, dataVersion: data.version, pageUrl: pageUrl() });
    } catch (e) {
      onfail(`Could not open the correction form: ${(e as Error).message}`);
      return;
    }
    await tick();
    warning.showModal();
  }
</script>

<dialog class="warning" bind:this={warning} aria-labelledby="warning">
  <h2 id="warning">Suggest a correction</h2>
  <p>The form is on GitHub. A request needs at least one Evidence Verse, and is published under CC BY-SA 4.0.</p>
  <p class="muted">For readers without a GitHub account, another way to send a request is coming.</p>
  <a href={asking} target="_blank" rel="noopener" onclick={() => warning.close()}>Open the form on GitHub</a>
  <button onclick={() => warning.close()}>Cancel</button>
</dialog>

<style>
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
</style>
