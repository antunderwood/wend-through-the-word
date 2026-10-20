// The "Suggest a correction" link (decision 131): pure, no DOM. It opens the "Correction request"
// issue form (.github/ISSUE_TEMPLATE/correction-request.yml) with its stable field IDs filled in.
import type { Id } from "./model";

// The form's "What is wrong?" options word for word, as GitHub fills a dropdown only by its text.
export const KINDS = {
  relationship: "A relationship (for example, a wrong or missing family link)",
  fact: "An entity fact (for example, gender, name, aliases, place, or year)",
  verse: "A verse link (for example, a verse names someone but has no link)",
};

export type Request = { kind: keyof typeof KINDS; nodeIds: Id[]; currentValue: string; dataVersion: string; pageUrl: string };

// tables is credits.json's curated tables link, "https://github.com/<owner>/<repo>/tree/...".
export function correctionLink(tables: string, r: Request): string {
  const repository = tables.split("/").slice(0, 5).join("/");
  const fields = { kind: KINDS[r.kind], node_ids: r.nodeIds.join(", "), current_value: r.currentValue, data_version: r.dataVersion, page_url: r.pageUrl };
  return `${repository}/issues/new?template=correction-request.yml` + Object.entries(fields).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");
}
