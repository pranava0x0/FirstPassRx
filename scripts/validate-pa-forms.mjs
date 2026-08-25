// Validate the captured PA-form corpus in docs/pa-drafting/forms/ against its manifest.
//
// Default (offline): every manifest entry's file exists on disk and its sha256 matches the
// manifest — catches silent edits/corruption of the committed blank forms.
// --live: additionally re-fetch each entry's source_url with a browser User-Agent and report
// reachability + byte drift. Drift (changed hash) is NOT a failure — payers revise forms on a
// schedule (MassHealth revised the inhaled-respiratory form 01/26 -> 07/26 within six months);
// it is a signal to re-capture and re-validate the template. Unreachable sources ARE failures.
//
// Same spirit as validate-links/validate-prices: dep-free, fail-loud, one-line summary.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formsDir = path.join(root, 'docs', 'pa-drafting', 'forms');
const manifestPath = path.join(formsDir, 'manifest.json');
const live = process.argv.includes('--live');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

let ok = 0;
let failed = 0;
let drifted = 0;

async function checkLive(entry) {
  try {
    const res = await fetch(entry.source_url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { reachable: false, detail: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = createHash('sha256').update(buf).digest('hex');
    return { reachable: true, drift: hash !== entry.sha256, liveBytes: buf.length };
  } catch (err) {
    return { reachable: false, detail: err.message };
  }
}

for (const entry of manifest.forms) {
  const filePath = path.join(formsDir, entry.file);
  const problems = [];

  if (!existsSync(filePath)) {
    problems.push('file missing on disk');
  } else {
    const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
    if (hash !== entry.sha256) problems.push(`local sha256 mismatch (got ${hash.slice(0, 12)}…)`);
  }

  let liveNote = '';
  if (live && problems.length === 0) {
    const result = await checkLive(entry);
    if (!result.reachable) {
      problems.push(`source unreachable: ${result.detail} (${entry.source_url})`);
    } else if (result.drift) {
      drifted += 1;
      liveNote = ` · LIVE DRIFT (${result.liveBytes}B upstream) — re-capture and re-validate template`;
    } else {
      liveNote = ' · live: unchanged';
    }
    await new Promise((r) => setTimeout(r, 1500)); // be polite to each host
  }

  if (problems.length > 0) {
    failed += 1;
    console.error(`✗ ${entry.file}: ${problems.join('; ')}`);
  } else {
    ok += 1;
    console.log(`✓ ${entry.file}${liveNote}`);
  }
}

console.log(
  `\n${ok}/${manifest.forms.length} forms valid` +
    (live ? ` · ${drifted} drifted upstream` : '') +
    (failed ? ` · ✗ ${failed} FAILED` : ''),
);
process.exit(failed > 0 ? 1 : 0);
