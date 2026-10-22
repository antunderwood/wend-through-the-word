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

   Open the address it prints (http://localhost:5173) and try the changes. To try the production build of the page instead, run `npm run build && npm run preview` (http://localhost:4173). To try a branch's export without touching `out/`, build it to another folder and start the server with `WEND_DATA=<that folder>/data npm run dev`.
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

Acting means: find the cause (a crawler, a loop, a Worker added by mistake) and tell the owner before the limit is reached; the Workers Paid plan is the owner's decision (PRD 8.5 rule 11).

## Renewing the Cloudflare API token

The deploy uses the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Renew the token before it expires, or at once if it may have leaked:

1. In the Cloudflare dashboard: My Profile, API Tokens, "Create Token", "Create Custom Token". Give it Account, Workers Scripts, Edit, for this account only, and an expiry date. If the first release recorded more permissions (for example Zone, DNS, Edit and Zone, Zone, Read for flying-ant.uk), give it those too, and no others.
2. Store it without echoing it: `gh secret set CLOUDFLARE_API_TOKEN` and paste the token at the prompt.
3. Check it works by deploying the current tag again: `gh workflow run deploy.yml -f tag=<current tag>`.
4. When that run passes, delete the old token in the dashboard.

## Updating the deploy workflow's actions

The Deploy workflow pins each action to a commit, with its version in a comment (decision 160). To move to a newer version, choose a release at least two weeks old, find its commit with `gh api repos/<owner>/<action>/commits/<version> --jq .sha`, and replace both the SHA and the comment.
