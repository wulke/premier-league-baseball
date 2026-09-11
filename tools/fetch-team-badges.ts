// Developer-run offline tool — NOT part of build/CI/tests.
// Downloads each club's crest from the curated TeamBadgeSources map and writes it to
// src/ui/assets/badges/<key>.svg, committed to the repo. Re-run manually whenever a
// source URL needs to change: `npm run fetch-team-badges`.
// @spec BADGE-001,BADGE-002,BADGE-003,BADGE-010
import * as fs from 'fs';
import * as path from 'path';
import { TeamBadgeSources } from '../src/api/team-pools/england-92';

const OUT_DIR = path.resolve(__dirname, '../src/ui/assets/badges');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(TeamBadgeSources);
  let succeeded = 0;
  let failed = 0;

  for (const [key, url] of entries) {
    try {
      // england-92.ts hardcodes every badge path as /badges/<key>.svg — enforce that every
      // source actually is an .svg here, rather than trusting a per-file inferred extension,
      // so the written filename can never drift from what TeamConfig.badge expects.
      if (!url.toLowerCase().endsWith('.svg')) {
        console.warn(`[fetch-team-badges] ${key}: source is not .svg, skipping (${url})`);
        failed++;
        continue;
      }
      // Wikimedia's robot policy rejects requests with no descriptive User-Agent (429).
      const response = await fetch(url, {
        headers: { 'User-Agent': 'premier-league-baseball-personal-project/1.0 (local dev tool; non-commercial)' },
      });
      if (!response.ok) {
        // @spec BADGE-002 — log and continue, never abort the batch.
        console.warn(`[fetch-team-badges] ${key}: ${response.status} ${response.statusText} (${url})`);
        failed++;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const dest = path.join(OUT_DIR, `${key}.svg`);
      // @spec BADGE-003 — always overwrite; no skip-if-exists check.
      fs.writeFileSync(dest, buffer);
      succeeded++;
    } catch (err) {
      console.warn(`[fetch-team-badges] ${key}: ${(err as Error).message} (${url})`);
      failed++;
    }
    await sleep(500); // stay polite to Wikimedia's rate limiter (a burst here can trigger a temporary block)
  }

  console.log(`[fetch-team-badges] done: ${succeeded} downloaded, ${failed} failed/skipped, ${entries.length} total sources.`);
};

run();
