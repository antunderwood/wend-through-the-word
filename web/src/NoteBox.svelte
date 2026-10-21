<script lang="ts">
  // The note on a step of Your Path or the Focus (decision 129). Notes live in this browser only.
  let { name, text, onnote, download, deleteAll }: { name: string; text: string; onnote: (text: string) => void; download: () => void; deleteAll: () => void } = $props();

  function askToDelete() {
    if (confirm("Delete all your notes? This cannot be undone.")) deleteAll();
  }
</script>

<section class="note">
  <label for="note">Note on {name}</label>
  <textarea id="note" data-tour="note" rows="4" value={text} oninput={(e) => onnote(e.currentTarget.value)}></textarea>
  <p class="muted">Notes stay in this browser only. Download them to keep them.</p>
  <button onclick={download}>Download notes</button>
  <button onclick={askToDelete}>Delete all notes</button>
</section>

<style>
  .note {
    margin: 10px 0;
  }
  label {
    display: block;
    font-size: 12px;
    color: #9aa0b4;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    margin: 4px 0 0;
    padding: 4px 6px;
    font: inherit;
    color: inherit;
    background: #161a28;
    border: 1px solid #3a4060;
    border-radius: 4px;
    resize: vertical;
  }
  .muted {
    font-size: 12px;
    color: #9aa0b4;
  }
  button {
    font: inherit;
    font-size: 12px;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
  }
</style>
