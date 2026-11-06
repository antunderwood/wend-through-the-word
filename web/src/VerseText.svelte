<!-- A shared Verse's BSB text: names in bold (decision 207) and referring terms underlined
     (decision 218), each in its node's type colour. Inline: the panel gives the paragraph. -->
<script lang="ts">
  import { boldNames, type Named, type Term } from "./bold";
  import { typeColour } from "./colours";
  import type { NodeType } from "./model";

  let { text, names, terms = [] }: { text: string; names: readonly Named[]; terms?: readonly Term[] } = $props();
</script>

{#each boldNames(text, names, terms) as r, j (j)}{#if r.bold}<strong style:color={typeColour(r.type as NodeType)}>{r.text}</strong>{:else if r.term}<span class="term" style:text-decoration-color={typeColour(r.type as NodeType)} title={r.name ? `Refers to ${r.name}` : undefined}>{r.text}</span>{:else}{r.text}{/if}{/each}

<style>
  /* Underlined, not bold: the words refer to the node without naming it. */
  .term {
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
</style>
