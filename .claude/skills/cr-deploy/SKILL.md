---
name: cr-deploy
description: Ship the current branch end-to-end -- update docs with session learnings, test, commit, push, open a PR, run a multi-persona code review (SW/Product/Data/Domain-expert) plus the codex bot if installed, address feedback, then merge to main and delete the branch. Use when the user says "ship this", "deploy", "open a PR and get it reviewed", or asks to run the CR/Deploy skill.
---

# CR/Deploy: doc-update -> PR -> multi-persona review -> merge -> cleanup

Runs the full path from a dirty working tree to a merged, cleaned-up `main`. Every phase before
the merge is reversible; the merge and branch deletion are not, so confirm the branch/PR identity
out loud before doing either, and never force-push or skip hooks to get there.

## Phase 1 -- Update docs with real learnings, then test

- Update `CLAUDE.md`'s project-specific scar-tissue section, `backlog.md`, and `issues.md` with
  what actually happened this session -- concrete findings (a broken assumption, a working
  invocation, a quirk), not generic filler. Skip a doc if the session produced nothing worth
  recording in it; don't pad.
- Run `npm run typecheck && npm test`, plus whichever of `npm run validate-links` /
  `npm run validate-prices` / `npm run trace` touch the files that changed. Fix every failure
  before moving on -- never commit red.

## Phase 2 -- Commit & push

- `git status` / `git diff` first; stage specific files (never `-A`/`.`) so nothing accidental
  (`.env`, scratch files) rides along.
- Write the commit message in the plain human voice: what changed and why, no AI co-author
  footer, no "Generated with Claude" line (global CLAUDE.md git-discipline rule).
- `git fetch origin` and confirm the branch isn't diverged from `origin/main` before pushing
  (`git rev-list --left-right --count origin/main...HEAD`); rebase onto a moved `main` rather than
  force-pushing over it if another session touched it.
- Push to the current feature branch. Never push directly to `main`.

## Phase 3 -- Open the PR

- `gh pr create` with a title under 70 chars and a body with a `## Summary` (bullets, what
  shipped) and a `## Test plan` (checklist of what was actually run/verified, not aspirational).
  Call out any known scope gaps or open items explicitly (see PR #3 for the tone: a "scope note"
  section beats silently shipping a partial feature).

## Phase 4 -- Multi-persona code review

- Spawn review agents in batches of **at most 2 concurrent** (project hard cap; ask the user
  before going wider). Each agent gets the PR diff + repo context and one distinct persona, e.g.:
  - **Senior SW engineer** -- correctness, architecture fit, test coverage, dead code.
  - **Product manager** -- scope, user value, whether the change matches what was asked, UX gaps.
  - **Data reviewer** -- for formulary/data changes: source citations, verification-state honesty,
    schema/validator regressions, count-floor risks.
  - **Domain expert** (clinical/pharmacy) -- drug-class accuracy, dosing/sig correctness, PA/BOGL
    claims, patient-safety framing (e.g. individualized-dosing language for insulin).
  Drop a persona that doesn't apply to this diff (e.g. skip the domain-expert pass on a pure CSS
  fix) rather than forcing a review with nothing to say.
- Read each persona's findings yourself before posting -- you're accountable for what lands on
  the PR, not the persona. Post each as its own `gh pr comment` (or inline `gh api` review
  comment when it anchors to a specific line), clearly labeled with the persona.
- Check whether the `chatgpt-codex-connector` bot (or an equivalent configured review bot) is
  installed on this repo; if so, wait for it to comment (poll `gh pr view --json comments` a
  handful of times with real spacing between checks, not a tight loop) before moving to Phase 5.
  If it never responds within a reasonable window, say so and proceed -- don't block indefinitely
  on a bot that may not be configured for this repo/PR.

## Phase 5 -- Address feedback

- Triage every comment: fix real issues inline; for anything out of scope or low-priority, log it
  to `backlog.md`/`issues.md` instead of silently dropping it, and say so in a PR reply.
- Update docs/tests again for whatever changed. Re-run the Phase 1 test commands.
- Commit and push the fixes as a new commit (don't amend a pushed commit).

## Phase 6 -- Merge & clean up

- Confirm tests are green and there are no unresolved blocking comments (a persona or the codex
  bot flagging something real that wasn't addressed).
- Merge with `gh pr merge --squash` (matches this repo's existing history -- one commit per PR on
  `main`) unless the user's asked for a different merge strategy.
- Delete the remote and local feature branch after a successful merge (`gh pr merge --delete-branch`
  handles the remote side; delete the local branch and switch back to `main` yourself).
- Report what shipped, what got fixed from review, and what got deferred to the backlog.
