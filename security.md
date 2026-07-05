# Security advisory log

Last updated: 2026-07-01

## Advisory sweeps

### 2026-07-01 — jsPDF for client-side appeal-letter PDF download

Source: `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt`.

Triggered by: adding `jspdf@4.2.1` (pinned exact) so the PA appeal letter downloads as a real PDF
file instead of opening the print dialog. Loaded via dynamic `import()` only when the user clicks
Export PDF, so it stays out of the main bundle.

**Result: clean.** No advisory names jspdf/jsPDF/pdf-lib or any client-side PDF generation
library. Active campaigns this sweep (none in our tree): Miasma / Mini Shai-Hulud (TanStack, @antv,
@redhat-cloud-services, SAP, Azure), TeamPCP/PCPcat (Trivy, LiteLLM, Nx Console), IronWorm (36 npm
pkgs), Operation Navy Ghost (PyPI pyrogram forks), 0DIN DNS-TXT injection, PromptSnatcher (Chrome
extensions), Agentjacking (Sentry DSN), Atomic Arch (AUR).

### 2026-06-29 — GitHub Actions deployment workflow

Source: `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (compact variant, generated 2026-06-28).

Triggered by: planned add of a GitHub Action deployment workflow (using `actions/checkout`, `actions/setup-node`, `peaceiris/actions-gh-pages` to push to `gh-pages` branch).

**Result: clean.** No advisories in the index target these actions. The active campaigns (Miasma, Solana FakeFix, Megalodon, Cordyceps) do not impact our planned usage of these actions. We will pin all actions to immutable commit SHAs for maximum security.

### 2026-06-28 — PDF-parser dependency for source archival/extraction

Source: `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (compact variant, generated 2026-06-28).

Triggered by: planned add of a PDF text-extraction devDependency (for `npm run archive-sources` /
`trace:live` content-tracing of the formulary PDFs).

**Result: clean.** The advisory index names no PDF-parsing library — `pdf-parse`, `pdfjs-dist`,
`pdf.js`, `unpdf`, `pdf2json`, `mupdf` are all absent. Safe to add (pin an exact version; `pdfjs-dist`
is Mozilla-official and the lowest-risk choice). Active campaigns this sweep (none in our tree):
Miasma / Mini Shai-Hulud (`@tanstack`, `@mistralai`, `@uipath`, `@opensearch-project`, `@mastra/*`,
`@gluestack-ui`, …), Phantom Gyp (`binding.gyp` script-bypass, `@vapi-ai/server-sdk`), IronWorm
(`asteroiddao`, 36 pkgs), Hades (MCP-targeted: `langchain-core-mcp`, `openai-mcp`, …), Solana
FakeFix, node-ipc (`9.1.6` / `9.2.3` / `12.0.1`).

### 2026-06-21 — project scaffold + dependency install

Source: `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (compact variant, generated 2026-06-21).

Triggered by: new project scaffold + first `npm install` of `vite`, `react`, `react-dom`,
`@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/*`, `gh-pages`.

**Result: clean.** None of the installed packages appear in the advisory index.

Active campaigns noted (not in our tree — no action needed, listed for awareness):

- **Mini Shai-Hulud (May 2026)** — `@tanstack/*`, `@mistralai/*`, `@opensearch-project/*`. Audit
  lockfile if any are ever added.
- **Shai-Hulud 3.0** — 492 npm packages, contained. IOC `@vietmoney/react-big-calendar@0.26.2`.
- **Mastra AI npm compromise** — 145 `@mastra/*` packages, `easy-day-js` typosquat RAT.
- **`chalk` (qix)**, **`axios`** — audit if transitively pulled.
- **React2Shell (CVE-2025-55182)** — unauth RCE in React Server Components. We ship a plain
  client SPA (no RSC), so not applicable; React pinned to 18.3.1 regardless.

Mitigations applied at scaffold time:

- Exact-pinned versions in `package.json` (no `^`/`~` ranges).
- `package-lock.json` committed; CI/deploy should use `npm ci`, not `npm install`.
- No third-party CDN assets (system fonts only, JSON bundled at build).

Refresh this sweep on the next trigger (new dependency add/upgrade, CDN asset, GitHub Action,
fetched install script) or if > 7 days old.
