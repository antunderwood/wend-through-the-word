<script lang="ts">
  // The note on a step of Your Path or the Focus (decision 129). Notes live in this browser only.
  let { name, text, onnote, download, deleteAll }: { name: string; text: string; onnote: (text: string) => void; download: () => void; deleteAll: () => void } = $props();

  function askToDelete() {
    if (confirm("Delete all your notes? This cannot be undone.")) deleteAll();
  }
</script>

<section class="note">
  <label for="note">Note on {name}</label>
  <textarea id="note" data-tour="note" rows="3" value={text} oninput={(e) => onnote(e.currentTarget.value)}></textarea>
  <!-- Download and Delete act on every note, not this node's: quiet links under the box. -->
  <p class="muted">
    Notes stay in this browser only.
    <button onclick={download}>Download notes</button>
    <button class="danger" onclick={askToDelete}>Delete all notes</button>
  </p>
</section>

<style>
  .note {
    margin: 16px 0 10px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  label {
    display: block;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    margin: 4px 0 0;
    padding: 4px 6px;
    font: inherit;
    color: inherit;
    background: var(--raised);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    resize: vertical;
  }
  .muted {
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  button {
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--text-soft);
    background: none;
    border: 0;
    padding: 0 0 0 6px;
    text-decoration: underline;
    cursor: pointer;
  }
  button:hover {
    color: var(--accent);
  }
  .danger:hover {
    color: #ff8a80;
  }
</style>
