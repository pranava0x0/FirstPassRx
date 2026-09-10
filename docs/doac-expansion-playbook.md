# DOAC anticoagulant state-by-state expansion playbook

Reference for scaling the `doac-anticoagulant` topic (shipped 2026-08-21 as `al-doac`, the proof
guide; scaled 2026-09-07 to `ny-doac`) to the remaining states, per the "one proof guide, then
scale on explicit user approval" gate documented in `docs/RESUME-EXPANSION.md`.

## Remaining states and their existing payer rosters to reuse

Every one of these states already has a payer roster built for other topics (ACE inhibitors, etc.)
— per CLAUDE.md's "check `state-index.json`/existing guides before spawning a discovery phase"
rule and `docs/agent-runs.md` cost lever #9, reuse that roster's payer metadata verbatim rather than
re-discovering it. `--reuse-payers-from` below names the anchor guide `build-gather-args.mjs` /
`merge-doac-guide.mjs` should read from:

| State | `--reuse-payers-from` | Payers | New guide id |
| --- | --- | --- | --- |
| CA | `ca-ace` | 3 (medi-cal-rx, kaiser-permanente-ca, anthem-bcbs-ca) | `ca-doac` |
| MA | `ma-ace` | 5 (masshealth, bcbsma, tufts, harvardpilgrim, mgb) | `ma-doac` |
| MD | `md-ace` | 8 (mdmedicaid, carefirst, kpmidatlantic, priority-partners, uhc-md, cigna, aetna, medicare-partd) | `md-doac` |
| VA | `va-ace` | 8 (va-medicaid-ffs, anthem-healthkeepers-plus, sentara-community, uhc-community, aetna-better-health, anthem-commercial, sentara-commercial, wellcare-value-script) | `va-doac` |
| IL | `il-ace` | 8 (il-medicaid, aetna-better-health-il, bcbs-community-il, countycare, meridian, molina-il, bcbs-illinois-commercial, wellcare-value-script) | `il-doac` |

`al-doac`, `ny-doac`, and `pa-doac` (shipped 2026-09-10) are done. Order is not load-bearing — the
user asked for NY first, then "the rest"; no ordering was specified among CA/MA/MD/VA/IL. Next up:
CA (cheapest remaining, 3-payer roster, no new-state discovery risk).

## Per-state recipe

1. **Assemble the gather args** (no agent needed for this step — deterministic):
   ```bash
   node scripts/build-gather-args.mjs \
     --state PA --reuse-payers-from pa-ace \
     --class-id doac-anticoagulant \
     --class-name "Oral Anticoagulants (DOACs)" \
     --class-desc "Direct oral anticoagulants (apixaban/Eliquis, rivaroxaban/Xarelto, dabigatran/Pradaxa, edoxaban/Savaysa) -- first-line therapy for stroke prevention in atrial fibrillation and treatment/prevention of venous thromboembolism, largely supplanting warfarin." \
     --stamp pa-doac-<today>
   ```
   This prints both the `formulary-gather.js` Workflow-tool `args` object AND a plain per-payer
   reminder list for hand-launching individual `Agent` tool calls (use the latter unless the user
   has opted into the `Workflow` tool this session — it has not been opted into as of 2026-09-07).

   **Caveat confirmed 2026-09-08 testing this script against `pa-ssris`:** a reused payer's
   `formularyUrl` can be topic-specific (e.g. a FormularyNavigator drug-*search* URL with an SSRI
   query param baked in, not a flat PDF) — the gather prompt's existing "if this URL doesn't have
   what you need, WebSearch for the correct current document" instruction already covers this, but
   don't assume every reused URL resolves directly to the DOAC section without checking.

2. **Gather each payer**, chunked to the hard 2-concurrent-agent cap (see CLAUDE.md). One agent per
   payer, covering the single `doac-anticoagulant` class from one fetch — reuse the exact prompt
   shape in `.claude/workflows/formulary-gather.js` (or the NY session's individual Agent-tool
   prompts, e.g. `ny-doac`'s gather in `docs/RESUME-EXPANSION.md`'s 2026-09-07 entry) if not using
   the Workflow tool. Known fetch-tier gotchas (see CLAUDE.md's "looks blocked but isn't" list —
   check per-host before assuming a source is dead):
   - `fm.formularynavigator.com`, `uhcprovider.com`, `client.formularynavigator.com`: WebFetch
     403s; plain `curl` with a browser User-Agent works.
   - A large government PDL PDF: WebFetch can either falsely report "corrupted/binary data" (while
     having already saved the raw bytes to a local path — `Read` that path directly) or dump the
     entire document into context uninvited — prefer a page-range-limited read or a `curl`+`grep`
     keyword probe over a blind `WebFetch` on a URL suspected to serve a large PDF.

3. **Merge the checkpoints** into a new guide (fails loud if any payer's checkpoint is missing —
   the guide is not written until every payer in the roster has one, per `formulary.ts`'s own
   payer-x-class count-floor validation):
   ```bash
   node scripts/merge-doac-guide.mjs \
     --checkpoint-dir data-gathering/pa-doac-<today> \
     --guide-id pa-doac --label "PA · DOAC Anticoagulants" \
     --state-code PA --region Pennsylvania \
     --reuse-payers-from pa-ace --reuse-class-from al-doac \
     --today <today>
   ```

4. **Check for the "non-preferred"/"higher tier" validator trip** the `ny-doac` merge hit: if a
   payer's binary Medicaid-style PDL genuinely makes "non-preferred" mean "PA required" (the
   normal case — see CLAUDE.md's reword-vs-reclassify rule), `formulary.ts`'s `validate()` still
   rejects any `paRequired[].reason` containing the literal phrase "non-preferred" or "higher
   tier" as a false-positive cost-sharing signal. Reword those reasons (keep the meaning, drop the
   trigger phrase) rather than reclassifying real PA barriers into `alternatives`. Only reclassify
   into `alternatives` if the payer's *own* document structure is a genuine multi-tier commercial
   cost-share list with no PA/step criteria stated (the `bcbs-illinois-commercial` precedent).

4a. **`preferredRestriction` is for a REAL barrier on the preferred agent (PA/step) — never for a
   quantity limit (QL) or Preventive-Drug-List (PV) flag alone.** Codex's review of `ny-doac`
   caught 3 of 5 records where a gather agent had put "Quantity limit only, no PA/step" text
   directly into `preferredRestriction` — the field's mere truthiness makes `ResultCard` render
   "even this first-pass pick needs plan sign-off," which reads as self-contradictory (and simply
   wrong) when the restriction text itself says no sign-off is needed. Set `preferredRestriction:
   null` whenever the only flag is QL/PV/tier — that detail is still preserved in
   `verificationNote` and (for alternatives) each item's `note`. **This exact pattern already
   exists in ~168 pre-existing records across 20+ shipped guides** (confirmed via a one-off audit
   2026-09-08) — that's a pre-existing, dataset-wide issue out of scope for a single state's DOAC
   merge; don't try to fix it globally mid-PR, but don't add new instances either. See `backlog.md`
   for the systemic cleanup entry.

4b. **Drop `paPolicyUrl` when reusing a payer object from another topic's guide** — it is
   frequently topic-specific (e.g. a menopause guide's Cigna payer carries an *estrogen-patch* PA
   policy URL) and `buildAppealLetter()` cites it verbatim in generated appeal letters. The
   checkpoint schema has no field to supply a DOAC-correct replacement, so `merge-doac-guide.mjs`
   now strips it rather than risk citing a wrong-topic policy link in a future state's guide
   (caught by Codex review before it could affect a real state — `--reuse-payers-from ny-ace`
   didn't trigger it since `ny-medicaid`'s `paPolicyUrl` happened to be topic-neutral, but
   `md-ace`'s Cigna payer would have).

5. **Run the full check**:
   ```bash
   npm run data:split
   npm test          # add the new guide id to formulary.test.ts's expected-order list first
   npm run validate-coverage
   npm run archive-sources
   ```

6. **Cash prices**: check `coveredDrugNames()` growth against `KNOWN_UNPRICED_GAP` in
   `src/lib/cash.ts` (a failing `cash.test.ts` run will show the exact delta). Add real rules for
   any new name variant of an already-priced molecule (apixaban/Eliquis, dabigatran/Pradaxa,
   warfarin/Jantoven all have rules as of `ny-doac`); bump the constant with a dated comment for
   genuinely new structural gaps (e.g. a state whose PDL prefers brand Xarelto at a dose GoodRx/
   Cost Plus don't stock — same class of gap as the existing rivaroxaban dose-mismatch trap).

7. **Commit and update `docs/RESUME-EXPANSION.md`** with a dated entry (what shipped, what was
   confirmed/found, test results) — follow the shape of the 2026-09-07 `ny-doac` entry.

## Why not the Workflow tool by default

`.claude/workflows/formulary-gather.js` already implements the gather step end-to-end and would
save some orchestration overhead, but launching it requires the user to have opted into
multi-agent orchestration for the session (explicit "use a workflow" / ultracode). Default to
individual `Agent` tool calls chunked to 2 concurrent (as done for `ny-doac`) unless the user opts
in; `build-gather-args.mjs`'s output works for either path.
