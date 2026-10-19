# 01: Publish the repository (M0 close)

**What to build:** the public repository goes live with clear licences. The owner confirms the licence record for every source, including the OpenBible.info licence split, the fixture licence note, and the Cloudflare KV, R2, and static asset limits checked on the official pages. The M0 work (licence files, project setup, download command, issue form, CI) is committed. Backup refs that still hold the old commit email are deleted. The repository is pushed private, CI goes green, and the "Correction request" form appears on the new issue page. Then the owner makes it public, and the spec moves into a GitHub issue.

**Blocked by:** None (can start immediately).

**Status:** needs-owner (not agent work: licence decisions belong to the owner, PRD 16.3)

- [ ] The owner has confirmed every entry in the licence record, and each unclear licence has a decision in the decision log
- [ ] No commit, branch, or ref in the pushed repository carries the old work email
- [ ] CI runs ruff and pytest on push and passes
- [ ] The "Correction request" form shows its fields, requires an Evidence Verse, and requires the CC BY-SA consent box
- [ ] A form URL with `node_ids`, `current_value`, `data_version`, and `page_url` query parameters opens with those fields filled in
- [ ] The repository is public
- [ ] The tracker is configured, and the Genesis data build spec is published as an issue with the `ready-for-agent` label
