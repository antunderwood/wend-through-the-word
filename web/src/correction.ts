// The "Suggest a correction" links (decisions 131 and 145): pure, no DOM. One opens the "Correction
// request" issue form (.github/ISSUE_TEMPLATE/correction-request.yml) with its stable field IDs filled
// in; the other is an email with the same fields in its body, for readers without a GitHub account.
import type { Id } from "./model";

// The form's "What is wrong?" options word for word, as GitHub fills a dropdown only by its text.
export const KINDS = {
  relationship: "A relationship (for example, a wrong or missing family link)",
  fact: "An entity fact (for example, gender, name, aliases, place, or year)",
  verse: "A verse link (for example, a verse names someone but has no link)",
};

export type CorrectionRequest = { kind: keyof typeof KINDS; nodeIds: Id[]; currentValue: string; dataVersion: string; pageUrl: string };

const fields = (r: CorrectionRequest) => ({ kind: KINDS[r.kind], node_ids: r.nodeIds.join(", "), current_value: r.currentValue, data_version: r.dataVersion, page_url: r.pageUrl });

// tables is credits.json's curated tables link, "https://github.com/<owner>/<repo>/tree/...".
export function correctionLink(tables: string, r: CorrectionRequest): string {
  const repository = tables.split("/").slice(0, 5).join("/");
  return `${repository}/issues/new?template=correction-request.yml` + Object.entries(fields(r)).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");
}

// The body follows the form's labels and order; the reader fills in the two empty lines.
export function correctionEmail(r: CorrectionRequest): string {
  const f = fields(r);
  const body = [
    `What is wrong? ${f.kind}`,
    `Node IDs: ${f.node_ids}`,
    `What the app shows now: ${f.current_value}`,
    "What it should be:",
    "Evidence verses (at least one, and what each shows):",
    `Data version: ${f.data_version}`,
    `Page URL: ${f.page_url}`,
    "",
    "By submitting, you agree that your suggestion may be included in the dataset under CC BY-SA 4.0.",
  ].join("\r\n");
  return `mailto:contact@wendtheword.flying-ant.uk?subject=${encodeURIComponent(`Correction: ${r.currentValue}`)}&body=${encodeURIComponent(body)}`;
}
