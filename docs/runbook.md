# Runbook

How to release, roll back, and look after the live site at https://wendtheword.flying-ant.uk (decisions 144, 152, 153). Commands run from the repository root.

## Release

1. Be on `main`, up to date with GitHub, with CI green, and `gh auth status` signed in.
2. For new data, set a new `data_version` (and `build_date`) in `build.toml`, commit it, and build the export:

   ```
   uv run python -m pipeline.build build.toml
   ```

   A data version is digits and hyphens only (the Deploy workflow refuses anything else before it reaches the environment): for a second data version on one day, add `-2`, as in `2026-10-22-2`, never a letter. Never reuse a data version for different data: files under `/data/<version>/` are cached for a year (decision 157). A release with code changes only can keep the data version.

   The whole Bible (data version 2026-10-22) took about 1.5 minutes and under 1 GB of memory on the owner's Mac (up to 5 minutes while other heavy work ran; about 2 minutes of processor time, a third of it measuring gzipped sizes). It writes 9,397 files: 417 MB raw, 53 MB gzipped, the largest 99 KB gzipped (the Psalm 119 Ring 2 file). Before compact JSON (decision 168) the same sources gave 655 MB raw, 57 MB gzipped.
3. Test the site locally on the new export before releasing. The dev server serves `out/data` (or the folder in `WEND_DATA`) at `/data`:

   ```
   cd web && npm ci && npm run dev
   ```

   Open the address it prints (http://localhost:5173) and try the changes. To try the production build of the page instead, run `npm run build && npm run preview` (http://localhost:4173). To try a branch's export without touching `out/`, build it to another folder and start the server with `WEND_DATA=<that folder>/data npm run dev`. The map uses Esri's tiles only when the page is built with the access token (decision 199); to try them locally, put the line `VITE_ESRI_TOKEN=<token>` in `web/.env.local` (gitignored, never committed), else the map falls back to OpenStreetMap's tiles. The live token only works from the site's address (its referrer restriction), so on localhost Esri refuses its tiles and the map shows the dots on the plain background; to see real tiles locally, use a second API key credential whose referrers include `http://localhost:*` and keep its token only in `web/.env.local`.
4. Try the release first. The dry run checks everything and makes the zip, but pushes and creates nothing:

   ```
   uv run python -m pipeline.release v2026-10-19 --dry-run
   ```

   Name the tag `v` plus the data version; add `.2`, `.3` for later releases of the same data. The command refuses when the working tree has uncommitted changes, the tag exists here or on GitHub, a file in `out/data` is over the size limit (500 KB gzipped or 25 MiB raw; measuring takes about 15 seconds for the whole Bible), `out/reports/split_or_trimmed.tsv` has a file that is not trimmed, `out/reports/curated_no_longer_matches.tsv` has rows (fix the curated tables, decision 77), or `out/data` holds 20,000 files or more. It prints a warning for each other report with rows: read them before releasing.
5. Release:

   ```
   uv run python -m pipeline.release v2026-10-19
   ```

   It zips `out/data` as `out/wend-data-<data version>.zip`, makes and pushes the tag, and creates the GitHub release with the zip attached and notes giving the data version, build date, and commit.
6. Publishing the release starts the Deploy workflow (`.github/workflows/deploy.yml`). Follow it with `gh run watch` (pick the Deploy run). It downloads the zip, builds and stages the page from the tag, runs the staged site tests on the folder it deploys, deploys with Wrangler, and runs the live check (`node web/live-check.ts`). Any failed step fails the run, and GitHub emails the owner.

   Upload size: the release zip of the whole Bible is 57 MB (63 MB before compact JSON), and the staged site 9,411 files, 418 MB. Wrangler uploads only files whose content changed, so the first whole-Bible release uploads nearly all of them and a later release only what changed. The staged site tests take 1 to 2 minutes on it. The first whole-Bible deploy (v2026-10-22, 2026-10-22) uploaded 9,391 files (8 already there) in 62 seconds; the Deploy step took 76 seconds and the whole workflow about 2 minutes. No total size limit was hit on the free plan.
7. If the command stops after pushing the tag (for example, `gh` failed), remove the tag and any draft release, then run it again:

   ```
   gh release delete v2026-10-19 --yes    # only if a draft release was made
   git push origin --delete v2026-10-19
   git tag -d v2026-10-19
   ```

The live check can be run by hand at any time: `node web/live-check.ts https://wendtheword.flying-ant.uk <data version> --email`. Leave out `--email` for any other address, such as a local `wrangler dev` server: only the live domain has Email Routing records (decision 162).

### After the first deploy: email

Attaching the custom domain lets Wrangler change DNS records for wendtheword.flying-ant.uk without asking, because CI has no terminal. The Email Routing records (decision 151) must survive. After the first deploy, and after any deploy that fails on the domain:

1. The deploy's live check already requires a Cloudflare MX record (it passes `--email`); also check the SPF record is there: `dig +short TXT wendtheword.flying-ant.uk` shows `v=spf1 include:_spf.mx.cloudflare.net ~all`.
2. Send a test email to contact@wendtheword.flying-ant.uk from another account, and check it arrives.
3. If either fails, open Email Routing for flying-ant.uk in the Cloudflare dashboard and add the subdomain's records again from its DNS settings (three `route1` to `route3.mx.cloudflare.net` MX records and the SPF record above, as on 2026-10-21).

## Roll back

Deploy an earlier tag again. Its own code and data are used, from that tag's release:

```
gh workflow run deploy.yml -f tag=v2026-10-19
gh run watch
```

Or, on GitHub: Actions, Deploy, "Run workflow", and enter the tag. Readers get the earlier version within five minutes (the `index.json` cache rule).

After a rollback, release the fix under a new data version, not the one rolled back: a browser that asked for a file of the rolled back version during those five minutes may have cached the not found answer.

## Weekly usage check (PRD 8.5 rule 10)

Once a week, in the Cloudflare dashboard:

1. Workers and Pages, then `wend-through-the-word`, then Metrics: requests and errors for the last 7 days. The site has no Worker script, so its requests are static asset requests, which are free and unlimited.
2. The account's Workers and Pages overview: Workers requests for each day. The free limit is 100,000 a day; act when a day passes 50,000 (half the limit).
3. D1 and KV: none in version 1. If phase 2 adds them, check their daily reads and writes against half of each limit too.
4. In the ArcGIS Location Platform dashboard, My dashboard, Usage, Developer credentials, the site's API key credentials: the basemap tiles used in the current billing cycle. The free allowance is 2 million tiles; Esri's pages read for decision 199 do not say over what period it resets, so take it as the billing cycle the dashboard shows and act when it passes 1 million (half). The account has no payment card and the owner set a usage alert or cap, so going over the allowance should stop the tiles (the map then shows its dots on the plain background) rather than charge. Requests no reader could account for may mean the token is used elsewhere despite its referrer restriction: rotate it (see "The map's Esri token").
5. Once a month, the Streets style's data sources: compare `copyrightText` in its metadata (`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/streets/static?f=json`, with the token as a `token` parameter, run in a terminal, never pasted into a file in the repository) with `ESRI_SOURCES` in `web/src/tiles.ts`, and update the file if they differ (Esri asks for the names to be checked often).

Acting means: find the cause (a crawler, a loop, a Worker added by mistake) and tell the owner before the limit is reached; the Workers Paid plan is the owner's decision (PRD 8.5 rule 11).

## Renewing the Cloudflare API token

The deploy uses the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Renew the token before it expires, or at once if it may have leaked:

1. In the Cloudflare dashboard: My Profile, API Tokens, "Create Token", "Create Custom Token". Give it Account, Workers Scripts, Edit, for this account only, and an expiry date. If the first release recorded more permissions (for example Zone, DNS, Edit and Zone, Zone, Read for flying-ant.uk), give it those too, and no others.
2. Store it without echoing it: `gh secret set CLOUDFLARE_API_TOKEN` and paste the token at the prompt.
3. Check it works by deploying the current tag again: `gh workflow run deploy.yml -f tag=<current tag>`.
4. When that run passes, delete the old token in the dashboard.

## The map's Esri token

The page is built with an access token (an API key) from the owner's ArcGIS Location Platform API key credentials, from the repository secret `ESRI_TOKEN` (decision 199). The token is in the page's JavaScript, so anyone can read it; its protection is the credentials' referrer restriction, `https://wendtheword.flying-ant.uk`, so Esri serves tiles only to pages on the site, and the usage alert or cap on the account. The Deploy workflow fails at "Stage the site" if the secret is empty, so a missing token never ships the OpenStreetMap fallback. CI builds its test page with the dummy token `ci-dummy`, never a real one.

1. Set it up (the owner, once): in the API key credentials, give only the location services privilege for basemaps, set the referrer to the origin `https://wendtheword.flying-ant.uk` (Esri's field takes no path or `/*`: a wildcard is allowed only for a whole subdomain), and choose an expiration date. A change to the referrers, the privileges, or the expiration date invalidates every key the credentials made, so generate the API key after the last change and copy it at once: Esri shows its value only then.
2. Set the secret (the owner, in a terminal; never paste the token into a chat or a file in the repository): `gh secret set ESRI_TOKEN` and paste the token at the prompt. Deploy the current tag again (`gh workflow run deploy.yml -f tag=<current tag>`) and check that the live map shows tiles.
3. To rotate it, before its expiration date or if its usage passes what the site explains: in the credentials, Settings, Application, "Generate a secondary API key" with a new expiration date (the first key stays valid meanwhile), set it as in step 2, deploy the current tag again, and when that run passes and the live map shows tiles, invalidate the first key. If the token may have leaked, invalidate it at once instead and generate a new one; the live map shows no tiles until the next deploy. Update `web/.env.local` too if you test locally with it.
4. Note each key's expiration date in the owner's calendar, a few weeks before it; the map shows no tiles once the key in the page has expired.

## Updating the deploy workflow's actions

The Deploy workflow pins each action to a commit, with its version in a comment (decision 160). To move to a newer version, choose a release at least two weeks old, find its commit with `gh api repos/<owner>/<action>/commits/<version> --jq .sha`, and replace both the SHA and the comment.

## Node limit test on a phone (#74)

The node limit test page is not deployed (decision 156), so a phone opens it from this computer over the home Wi-Fi.

1. Build an export (`out/data`, see Release step 2), then build the page and start the preview on the local network:

   ```
   cd web && npm run build && npx vite preview --host --port 4173
   ```

   `--host` makes the preview listen on the network as well as on this computer. Allow the incoming connection if macOS asks.
2. Find this computer's address on the network: `ipconfig getifaddr en0` (for example `192.168.1.20`).
3. On the phone, on the same Wi-Fi, open `http://<address>:4173/node-limit.html`.
4. Run the test as on a desktop (decisions 123 and 150): note the phone, its browser, and the frame rate at each node count. The PRD's target is up to 150 nodes at 30 frames per second or more (PRD 11); the node limit is 500 on every screen (decision 177).
5. Stop the preview with Ctrl+C. Record the result as a decision. There is one node limit and no phone limit (decision 177): a phone that cannot draw 500 nodes smoothly is a decision about that limit, not a separate phone value.

## Redrawing the site icon

The splash's graphic is `ICON` in `web/src/splash.ts`; `web/public/icon.svg` draws the same graph, and the PNG icons are rendered from the SVG (decision 205). After changing both, render the PNGs again from the repository root:

```
node web/icons.ts
```

It writes `web/public/icon.png` (32 px) and `web/public/apple-touch-icon.png` (180 px, square corners) with Playwright's Chromium (`cd web && npx playwright install chromium` once if it is missing). Then `cd web && npx vitest run tests/splash.test.ts` checks that the SVG, `ICON` and both PNGs agree. Open the PNGs to look at them before committing.

## Re-measuring the bold rule

The rule that bolds names in the shared Verses was measured on the whole Bible (decision 207). After a new export, measure it again from the repository root:

```
node web/measure-bold.ts out/data/<version>
```

It reads the export only and prints the hit rate of Person and Place mentions and, over every pair of nodes in one Verse, the bold runs the pair adds or loses against each node alone, with the first 10 of each (`--all` lists every one). Compare them with the decision's numbers; a change worth keeping goes in the decision.

## A browser spec fails in CI but not on your machine

CI's runner draws text in DejaVu Sans, which is wider than the font in the stock Playwright image and on a Mac, so a row can wrap or a label can cover a control only there. To reproduce it, run the failing specs once in `mcr.microsoft.com/playwright:v1.63.0-noble` (the version in `web/package.json`) after `apt-get install -y fonts-dejavu-core`. Run only the failing specs, once.
