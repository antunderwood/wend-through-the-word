<script lang="ts">
  // The credits page (decision 132): every source in credits.json with its credit, licence, and
  // link, and the modification notice the CC BY-SA licence asks for (PRD 5 rule 6). No WebGL.
  import { fetchJSON, readCredits } from "./data";
  import { MAP_LIBRARY, TILES } from "./tiles";

  const load = () => readCredits(fetchJSON, "/data");
  let loading = $state(load());
</script>

<main>
  <p><a href="/">Back to the graph</a></p>
  <h1>About and credits</h1>
  {#await loading then { version, credits }}
    <p>The data (version {version}) is released under <a href={credits.licence_link}>{credits.licence}</a>.</p>
    <p>{credits.modified}</p>
    <p><a href={credits.curated_tables}>The curated tables</a></p>
    <h2 id="sources">Sources</h2>
    <ul aria-labelledby="sources">
      {#each credits.sources as s (s.name)}
        <li>
          <a href={s.link}>{s.name}</a>
          <p>{s.credit}</p>
          <p class="muted">Licence: {#if s.licence_link}<a href={s.licence_link}>{s.licence}</a>{:else}{s.licence}{/if}</p>
          {#if s.bibliography}<p class="muted"><a href={s.bibliography}>Source bibliography</a></p>{/if}
        </li>
      {/each}
    </ul>
  {:catch e}
    <p role="alert">Could not load the credits: {e.message} <button onclick={() => (loading = load())}>Retry</button></p>
  {/await}
  <!-- The map's tiles load from the provider only when a reader opens the map (decisions 189, 199). -->
  <h2 id="map">Map</h2>
  <ul aria-labelledby="map">
    {#each TILES.credits as c (c.name)}
      <li>
        <a href={c.link}>{c.name}</a>
        <p>{c.credit}</p>
        <p class="muted">Licence: {#if c.licenceLink}<a href={c.licenceLink}>{c.licence}</a>{:else}{c.licence}{/if}</p>
      </li>
    {/each}
    <li>
      <a href={MAP_LIBRARY.link}>{MAP_LIBRARY.name}</a>
      <p>The library that draws the map.</p>
      <p class="muted">Licence: {MAP_LIBRARY.licence}</p>
    </li>
  </ul>
</main>

<style>
  ul {
    padding: 0;
    list-style: none;
  }
  li {
    margin: 0 0 18px;
  }
  li p {
    margin: 2px 0;
  }
  .muted {
    color: #9aa0b4;
    font-size: 13px;
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
