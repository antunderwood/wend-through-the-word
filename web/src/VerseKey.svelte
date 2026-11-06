<!-- The key to a list of Verses (decision 226): which colour is which node, so the reader can see
     where each one sits in the text. Only a Person's and a Place's names are found in the text (bold,
     decision 207) and the owner's referring terms (underlined, decision 221); any other node in the
     list is listed in the Verse's heading, so the key says so rather than leave the reader to look
     for a mark that is not there. -->
<script lang="ts">
  import type { Named } from "./bold";
  import { typeColour } from "./colours";
  import type { NodeType } from "./model";

  let { names, underlined = false }: { names: readonly Named[]; underlined?: boolean } = $props();
  const placed = (n: Named) => n.type === "person" || n.type === "place";
  const unmarked = $derived(names.filter((n) => !placed(n)));
</script>

{#if names.length}
  <p class="key" aria-label="Key to the marks in the verses">
    {#each names as n (n.name + n.type)}
      <span class="item"><span class="dot" style:background={typeColour(n.type as NodeType)}></span>{#if placed(n)}<strong style:color={typeColour(n.type as NodeType)}>{n.name.replace(/ \(.*\)$/, "")}</strong>{:else}{n.name.replace(/ \(.*\)$/, "")}{/if}</span>
    {/each}
    {#if underlined}<span class="item"><span class="u">underlined</span> refers to it without naming it</span>{/if}
    {#if unmarked.length}<span class="note">{unmarked.map((n) => n.name.replace(/ \(.*\)$/, "")).join(" and ")} {unmarked.length === 1 ? "is" : "are"} not marked: only the names of people and places are found in the text.</span>{/if}
  </p>
{/if}

<style>
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin: 0 0 8px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .u {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .note {
    flex-basis: 100%;
  }
</style>
