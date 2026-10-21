<script lang="ts">
  // "Suggest a correction" (decisions 131 and 145): the issue form's address and the email fallback,
  // shown after a warning about what a request needs. pageUrl() is the shareable address of what the
  // reader sees.
  import { tick } from "svelte";
  import { correctionEmail, correctionLink, type CorrectionRequest } from "./correction";
  import type { Data } from "./data";
  import type { Id } from "./model";

  let { data, pageUrl, onfail }: { data: Data; pageUrl: () => string; onfail: (message: string) => void } = $props();
  let asking = $state<{ form: string; email: string }>();
  let warning: HTMLDialogElement;

  export async function suggest(kind: CorrectionRequest["kind"], nodeIds: Id[], currentValue: string) {
    try {
      const r = { kind, nodeIds, currentValue, dataVersion: data.version, pageUrl: pageUrl() };
      asking = { form: correctionLink((await data.credits()).curated_tables, r), email: correctionEmail(r) };
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
  <p class="muted">For readers without a GitHub account, email works too. The owner copies each email into a GitHub issue without your name or email address, then deletes the email.</p>
  <a href={asking?.form} target="_blank" rel="noopener" onclick={() => warning.close()}>Open the form on GitHub</a>
  <a href={asking?.email} onclick={() => warning.close()}>Send it by email</a>
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
