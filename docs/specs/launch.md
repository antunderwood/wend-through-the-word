# Spec: Launch (M5)

Status: ready-for-agent
Date: 2026-10-21
Sources: `PRD.md` (Draft 5, sections 5, 8, 10.5, 11, 13), `GLOSSARY.md`, `docs/decisions.md` (decisions 47, 113, 120, 123, 128, 144 to 158), `docs/specs/navigation.md`, `docs/specs/reading-and-sharing.md`

Terms follow `GLOSSARY.md`. Published as issue #46. The issue is the working copy for agents. This file is the reference copy. M3 and M4 are merged; the page, the Genesis export, the credits page, correction links, and the contact address all exist. This spec ships them.

## Problem Statement

The application runs only on the owner's machine. Readers cannot reach it, links that readers share (decisions 128 and 149) point nowhere, and Correction Requests cannot reach the public repository, because it is still private (decision 47). There is no repeatable deploy: the prototype was pushed by hand with a throwaway script (decision 113), with no cache rules, no check that Cloudflare's limits hold, and no check after a deploy that the site works. The owner also wants new readers to learn the student journey with a first-run tour (decision 120), which only the prototype had.

## Solution

1. **A release flow.** The owner builds the Genesis export locally, where the downloaded sources are, and runs one release command. It checks the export, pushes the release tag, and publishes a GitHub release with the export attached. Publishing the release starts a GitHub Actions workflow (decision 158) that downloads that export, builds the page, assembles the staged site, checks it, deploys it to Cloudflare Workers static assets at wendtheword.flying-ant.uk (decision 144), and runs a live check against the site. There is still no Worker script.
2. **Cache and size rules.** Versioned data files and the page's hashed files are cached for a year; `index.json` and the pages for a short time (PRD 8.5 rule 6). The staged site stays under Cloudflare's file count and file size limits (PRD 8.4).
3. **A first-run tour** of the student journey ("studying Abraham") that a new reader can take or skip, restart from a help link, in any view.
4. **Launch polish**: a page title and description, an icon, and a not found page.
5. **The repository goes public** (#14) once the release works, so readers can open Correction Requests and see the curated tables.

## User Stories

### Reader

1. As a reader, I want to open wendtheword.flying-ant.uk and see the Genesis graph, so that I can use the application without installing anything.
2. As a reader, I want links that others share (`?focus=Gen.22.2`, `?focus=person:abraham_58`) to open the same view on the live site, so that sharing works.
3. As a reader, I want the first visit to load in under 3 seconds on a home network (PRD 11), so that I do not give up waiting.
4. As a reader, I want later visits to load faster from my browser's cache, so that returning is quick.
5. As a reader, I want a new data release to reach me within minutes, without old and new files mixing, so that I never see a broken mix of data versions.
6. As a reader, I want a clear page when I follow a broken address, with a link back to the graph, so that I am not left on a blank screen.
7. As a reader, I want the browser tab to show the application's name and icon, so that I can find it among my tabs.
8. As a reader, I want a link preview (title and short description) when I paste the address into a message, so that the person I send it to knows what it is.
9. As a reader on my first visit, I want to be offered a short tour of studying Abraham, so that I learn how to search, select, move the Focus, pin, read, and use Your Path.
10. As a reader, I want to skip the tour with one click and not be asked again in this browser, so that it never gets in my way.
11. As a reader, I want to restart the tour later from a help link, so that I can learn it when I am ready.
12. As a reader, I want each tour step to tell me what to do and wait for me to do it, with a "Do it for me" option, so that I learn by doing but never get stuck.
13. As a reader, I want the tour to work in the tilted plane, stacked discs, and free orbit, and with the keyboard, so that my choice of view or input does not break it.
14. As a reader, I want the tour to leave my own Your Path, pins, and notes as they were when it ends, so that taking the tour costs me nothing.
15. As a reader who prefers reduced motion, I want the tour to move nothing that the rest of the page would not move, so that my setting is respected.
16. As a reader without a GitHub account, I want "Suggest a correction" to offer the contact address, so that I can still report an error (decision 145).
17. As a reader with a GitHub account, I want "Suggest a correction" to open the public issue form with the fields filled in, so that I can report an error in a minute.
18. As a reader, I want the "About and credits" page to link to the public curated tables, so that I can see what the owner changed.

### Owner

19. As the owner, I want one release command that checks my local export, attaches it to a GitHub release, and pushes the tag, so that releasing is one step (PRD 8.5 rule 9).
20. As the owner, I want the release command to refuse an export that fails the build's checks (size limit, file count, reports with failures), so that I never ship broken data.
21. As the owner, I want each release tag to pin the exact data and code that shipped, so that I can say what was live on any day and roll back.
22. As the owner, I want the deploy to run in GitHub Actions when the release is published, so that it does not depend on my machine's state.
23. As the owner, I want the Cloudflare API token and account ID kept as GitHub secrets with the narrowest permissions, so that a leak cannot touch the rest of my account.
24. As the owner, I want the Wrangler configuration in the repository (PRD 8.5 rule 9), so that the deploy is reviewable.
25. As the owner, I want the deploy to attach the custom domain wendtheword.flying-ant.uk, so that DNS and the certificate are handled by Cloudflare (decision 144).
26. As the owner, I want a live check after each deploy, so that I know the site works, the cache headers are right, and the data is compressed (PRD 8.5 rules 6 and 7).
27. As the owner, I want the deploy to fail loudly if the live check fails, so that a broken release is noticed at once.
28. As the owner, I want the node limit test page left out of production, so that readers never find an owner tool.
29. As the owner, I want the staged site checked against Cloudflare's free limits (20,000 files, 25 MiB per file, checked again on the official pages before launch), so that a deploy never fails on a limit.
30. As the owner, I want a short runbook for releasing, rolling back, and the weekly usage check (PRD 8.5 rule 10), so that I can run the site without rereading the code.
31. As the owner, I want to roll back by redeploying an earlier tag, so that a bad release is undone in one step.
32. As the owner, I want the repository made public only after a history check finds no personal data or secrets and the licences are rechecked (#14), so that going public is safe.
33. As the owner, I want the first-run tour to record nothing and send nothing, so that the site keeps its no-server, no-tracking design.

### Developer

34. As a developer, I want one staging step that assembles exactly what is deployed, so that tests check the real thing.
35. As a developer, I want the staging tests to run in CI on every push, with the fixture export, so that a change that breaks the deploy is caught before a release.
36. As a developer, I want the live check to be a script I can run against any URL, so that I can check a preview or the live site the same way.
37. As a developer, I want the tour steps defined as data (a target, an instruction, a check, a "do it for me" action), so that a step is added or changed in one place.
38. As a developer, I want the tour to drive the page only through its public actions, so that it cannot reach into the Focus Model or the graph module.

## Implementation Decisions

### Release and deploy

- **Release asset** (decision 153). The owner builds the export locally. A release command (in the repository's task runner) runs the export checks, zips `out/data` with the data version in its name, creates a GitHub release for the given tag with the zip attached, and pushes the tag. The release notes list the data version, the build date, and the commit.
- **Deploy on a published release** (decisions 152 and 158). A GitHub Actions workflow runs when a GitHub release is published, not on the tag push: the release command pushes the tag before it uploads the data asset. It downloads the release's data asset, builds the page in production mode, runs the staging step and its tests, deploys with Wrangler, then runs the live check against wendtheword.flying-ant.uk. Amends PRD 8.5 rule 9 ("a deploy must run from one command"): the one command is the release command, and publishing the release does the rest.
- **Secrets.** `CLOUDFLARE_API_TOKEN` (scoped to Workers scripts and the flying-ant.uk zone's routes) and `CLOUDFLARE_ACCOUNT_ID` live as GitHub repository secrets, set by the owner (a ticket for the owner). Nothing else needs a secret.
- **Wrangler configuration in the repository**: an assets-only Worker (no `main`, so no Worker script, PRD 3 and 12 item 12) named for the application, the staged folder as its assets directory, the custom domain `wendtheword.flying-ant.uk`, and not found handling that serves the not found page.
- **Rollback**: re-run the deploy workflow on an earlier tag (workflow dispatch with a tag input). The runbook says how.

### Staged site

- **One staging step** builds the folder that is deployed: the page's production build without the node limit page (decision 156), the export under `/data`, the not found page, and the headers file.
- **Cache rules** (decision 157), in Workers static assets' headers file: files under `/data/<version>/` and the page's hashed files: `public, max-age=31536000, immutable`; `/data/index.json`: `public, max-age=300`; HTML pages: `public, max-age=0, must-revalidate`. The versioned data path is what makes long caching safe (PRD 8.5 rule 6); `index.json` points the page at the current version.
- **Limits**: the staged folder must hold fewer than 20,000 files and no file over 25 MiB (PRD 8.4, rechecked against Cloudflare's pages before the first release and the check date recorded). Genesis is about 1,330 data files.

### Live check

- A script that takes a base URL and checks: the main page, the credits page, and a shared Verse address answer 200; the not found page answers 404 for an unknown path; `index.json` has the short cache rule; a versioned chapter file and an entity file have the long rule and are served compressed (`content-encoding` gzip or br when asked); the data version served matches the release; the node limit page is absent. It exits non-zero with a plain list of failures.

### First-run tour

- **In M5** (decision 155). Offered on the first visit, and again until the reader takes or skips it (stored with the M3 storage wrapper), skippable, restartable from a "Help: take the tour" link in the footer.
- **Steps as data**, lifted from the prototype's tour (branch `prototype/navigation`, about ten steps: move the camera, search Abraham, select Sarah, select Abraham, open his Themes, select a Theme and read the shared Verses, make Isaac the Focus, pin Abraham, Prev and Next, Clear and Undo clear), extended for M4: open the reader panel, write a note. Each step has a target, an instruction, a check that the reader did it, and a "Do it for me" action that uses the page's own actions. No timings or result copying (that was for the ABC test).
- **Leaves no trace**: the tour saves the reader's Focus, Your Path, pins, selection, and filters on start and restores them on finish or skip; notes written during the tour are removed unless the reader keeps them.
- Works in all three views and with the keyboard; respects reduced motion; the tour box never covers the step's target.

### Launch polish

- Page title "Wend Through the Word", a one-line description and Open Graph title and description for link previews, a simple icon in the type colours, and a not found page with a link to the graph.

### Going public

- #14 (ready-for-human) is the last step: history and refs checked for personal data and secrets, `docs/licences.md` rechecked, then the owner makes the repository public and checks the credits links and the correction form as a signed out reader.

## Testing Decisions

- **Seams** (decision 154): the existing build, Vitest, and Playwright seams stay. Two new ones:
  1. **The staged site.** Tests run the staging step on the fixture export and assert on the folder: file count and sizes within the limits, the headers file has the three cache rules for the right paths, the node limit page is absent, the not found page is present, the data index points at a version folder that exists. They run in CI on every push.
  2. **The live check script**, run by the deploy workflow after each deploy and by hand against any URL. Its own logic is tested against a local server that serves the staged folder with the same headers (Wrangler's local dev server), so a broken check is caught before a release.
- **The tour** is tested through Playwright on the fixture export: offered once, skip remembered, restart from the footer, each step's check passes after the reader's action and after "Do it for me", the reader's Your Path, pins, and notes are unchanged after finishing, in views A, B, and C, and once with the keyboard only. Steps use fixture stand-ins where the real Genesis example is missing, as before.
- **What makes a good test here.** It checks what a reader or the owner would see: "`index.json` is cached for five minutes", "the staged site has no node limit page", "skipping the tour is remembered". It does not check the workflow file's YAML or Wrangler's internals.
- **Prior art.** The CI job that builds the fixture export and runs the front end tests; `tests/conftest.py` for building the fixture export; the M3 and M4 Playwright journeys; the prototype's tour on `prototype/navigation` and `prototypes/navigation/deploy.sh` there (the Workers static assets deploy and credits staging it proved).

## Out of Scope

- The whole Bible (M6) and the mobile release (M7).
- Any Worker script, D1, or KV (phase 2).
- Analytics, error reporting services, or any tracking.
- A staging environment or preview deploys per branch.
- Building the data export in CI (decision 153).
- The curated link corrections of #44.

## Further Notes

1. **Decisions 152 to 157** record this spec's choices: deploy in GitHub Actions (owner, amends PRD 8.5 rule 9; decision 158 runs it on the published release, not the tag push), the export as a release asset (owner), the staged site and live check seams (owner), the first-run tour in M5 (owner, settles decision 120), the node limit page left out (owner), and the cache rules.
2. **Free tier check.** PRD 8.4 asks for the limits to be checked again on Cloudflare's official pages before launch; the first release ticket records the date and values.
3. **Repository size.** Release assets do not enter git history, so M6's larger export (several hundred MB in files, compressed far smaller) does not bloat the repository.
4. **Domain.** flying-ant.uk uses Cloudflare's nameservers (checked 2026-10-21), so the custom domain needs no DNS work by hand; the token must cover that zone.
