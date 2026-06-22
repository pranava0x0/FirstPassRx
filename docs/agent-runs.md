# Agent & workflow run log

A running record of every multi-agent fan-out launched for this project, with the retrospective
required by [AGENTS.md → Evaluate every agent run](../AGENTS.md). Append a row when you spawn a
workflow or a standalone agent; keep `runId` so a dropped run can be resumed. (Transcript paths are
machine-local and deliberately omitted — reference by `runId` + workflow name instead.)

## Totals (session 2026-06-22)

- **4 workflows · 34 sub-agents · ~1.72M sub-agent tokens · 561 tool-uses**
- 1 sub-agent failure (a connection drop) — output recovered from a sibling agent + domain knowledge.
- 0 standalone `Agent`-tool calls; 0 in the latest (resync/review/merge) turn — that was all inline.

## Runs

| # | Workflow (`runId`) | Agents | Tokens | Tools | Duration | Outcome |
|---|---|---|---|---|---|---|
| 1 | `firstpassrx-review` · `wf_2e2424bf-042` | 5 | 224.3k | 121 | ~4m03s | 1 confirmed finding (appeal-btn 44px target) |
| 2 | `firstpassrx-sources` · `wf_136d2832-406` | 13 | ~711–727k | 259 | ~21m14s (wall) | Publisher-verified sources + real formulary data |
| 3 | `firstpassrx-design` · `wf_ba8b6c67-3d1` | 5 | 267.5k | 23 | ~6m38s | "Monograph" visual identity synthesis |
| 4 | `firstpassrx-review-2` · `wf_a31f79a1-e48` | 11 | 496.5k | 158 | ~2m51s | 3 confirmed findings |

### 1 · firstpassrx-review (scaffold review)
- **Shape:** 4 dimensions (clinical · a11y · design-code · deploy) → adversarial verify per finding.
- **Result:** confirmed the scaffold clean; 1 real finding (disabled appeal button below 44px).
- **Retrospective:** *borderline.* 224k tokens for one minor finding on a ~15-file scaffold. An
  inline review (~40k) would have sufficed; the fan-out was heavier than the surface warranted.

### 2 · firstpassrx-sources (data + citations) — the high-value run
- **Shape:** Research phase = 8 agents (5 payers + classes + generics/biosimilars + biologics);
  Verify phase = 5 agents re-fetching each payer's primary URL to confirm publisher + effective date.
- **Per-agent (from the run widget):**
  | Agent | Tokens | Tools | Time |
  |---|---|---|---|
  | research:masshealth | 55.3k | 20 | 3m26s |
  | research:bcbsma | 52.3k | 24 | 3m06s |
  | research:tufts | 76.4k | 28 | 5m25s |
  | research:harvardpilgrim | 70.1k | 33 | 5m01s |
  | research:mgb | 52.5k | 16 | 3m12s |
  | research:classes | 57.1k | 22 | 3m21s |
  | research:generics_biosimilars | 69.8k | 37 | 4m58s |
  | research:biologics | 70.2k | 32 | 5m11s → **FAILED: "API Error: Connection closed mid-response"** |
  | verify:masshealth | 34.9k | 4 | 3m32s |
  | verify:bcbsma | 34.2k | 3 | 4m31s |
  | verify:tufts | 33.6k | 3 | 5m45s |
  | verify:harvardpilgrim | 33.2k | 2 | 5m45s |
  | verify:mgb | 33.1k | 2 | 5m45s |
- **Result:** verified, publisher-confirmed sources and real facts (the MassHealth Ventolin BOGL, MGB
  Arnuity/QVAR step rule, generics-vs-biosimilars). The foundation of the sourced dataset.
- **Failure:** `research:biologics` died on a connection drop and its output was **lost** (returns are
  in-band) — recovered from the generics agent's biologics facts + domain knowledge, so nothing
  critical was missing.
- **Retrospective:** *high value, exposed the no-checkpoint risk.* 13 single-topic agents violated
  "batch by breadth"; the verify phase earned its cost ("a 200 is not proof"). The loss drove the
  fix: the [`formulary-data` skill](../.claude/skills/formulary-data/SKILL.md) (checkpoint each source
  to disk before returning) and the AGENTS.md note on Workflow-tool resume by `runId`.

### 3 · firstpassrx-design (de-AI redesign)
- **Shape:** 1 web-research agent (AI-look tells + clinical/editorial references) → 3 anchored
  direction proposals (leaflet · editorial · clinical-sw) → 1 synthesis.
- **Result:** the "Monograph" identity that cleared the user's anti-AI bar (warm paper, one rationed
  accent, serif+mono+sans mapped to meaning, hairline rules, no cards/shadows).
- **Retrospective:** *justified.* The 3-anchor divergence beat a one-shot inline design; the spec
  drove the full rewrite.

### 4 · firstpassrx-review-2 (rewrite review)
- **Shape:** 4 dimensions (clinical · a11y · design-code · citations-integrity) → adversarial verify.
- **Result:** 3 confirmed findings (search clear target, glossary popover shadow, empty-state class);
  clinical + citation dimensions came back clean.
- **Failure mode:** **missed** the glossary-uppercase bug — caught instead by a screenshot/visual QA.
- **Retrospective:** *heavy.* 496k for 3 findings. Lesson: a lighter inline review + a screenshot
  pass would have matched it cheaper. Visual QA catches what review agents miss — keep it in the loop.

## Standing practice

Prefer inline (grep / read / one WebFetch / a screenshot); reserve fan-outs for genuinely large or
divergent work. After any agent/workflow run, add its row here and give the user the one-line
retrospective (scope · solved? · failures · token-efficiency · cheaper alternative).
