// The journey notes download (decision 129): pure, no DOM. steps are Your Path oldest first, then
// the Focus; a step with no note is still listed, so the file reads as the journey.
import type { Id } from "./model";

export function notesMarkdown(steps: Id[], notes: Record<Id, string>, label: (id: Id) => string, type: (id: Id) => string, link: (id: Id) => string, date: Date) {
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const parts = [`# Journey notes, ${day}`];
  steps.forEach((id, i) => {
    parts.push(`## ${i + 1}. ${label(id)}`, `*${type(id)}*, [open as the Focus](${link(id)})`);
    if (notes[id]) parts.push(notes[id]);
  });
  return parts.join("\n\n") + "\n";
}
