export const meta = {
  name: 'formulary-gather',
  description:
    'Research real formulary coverage for a batch of payers (each covering one or more drug-class cells) for FirstPassRx and checkpoint each result to disk as a mergeable record.',
  phases: [{ title: 'Gather', detail: 'one research agent per payer, chunked to <=2 concurrent' }],
}

// Reusable across ANY future (state, topic) guide -- do not hardcode state/payer/class specifics here.
//
// args shape:
// {
//   stamp: 'ny-ace-nsaid-expand-2026-07-06',   // data-gathering/<stamp>/ checkpoint dir
//   state: 'New York',
//   today: '2026-07-06',                        // stand-in for new Date() (unavailable in scripts)
//   payerTasks: [
//     {
//       payerId: 'ny-excellus-bcbs',
//       payerName: 'Excellus BlueCross BlueShield (Commercial)',
//       payerFormularyUrl: 'https://...',
//       payerFormularyLabel: 'Excellus 2026 Metal Plans Formulary Guide',
//       payerPbm: 'Express Scripts (ESI)',
//       classes: [
//         { classId: 'ace-inhibitor', className: 'ACE inhibitors', classDescription: '...' },
//         { classId: 'nsaid-oral', className: 'Oral NSAIDs', classDescription: '...' },
//       ],
//     },
//     ...
//   ],
// }
//
// One agent per payer, covering EVERY class assigned to it off a SINGLE fetch of that payer's
// formulary -- not one agent per (payer, class) cell. A prior run of this script (2026-07-06,
// see docs/agent-runs.md) used a flat per-cell shape and had every payer's PDF independently
// fetched twice (once per class); this shape exists specifically to stop that from recurring
// (see docs/agent-runs.md's cost lever #1: "gather per entity, not per cell").
//
// FirstPassRx hard rule (see CLAUDE.md): never run more than 2 concurrent agents. This script
// enforces that itself by chunking, rather than trusting parallel()'s default concurrency cap.

// Defensive: this harness has been observed to hand `args` through as a JSON-encoded string
// rather than the parsed object the Workflow tool docs describe -- accept either shape.
const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
const { stamp, state, today, payerTasks } = parsedArgs

phase('Gather')

const results = []
for (let i = 0; i < payerTasks.length; i += 2) {
  const chunk = payerTasks.slice(i, i + 2)
  const chunkResults = await parallel(
    chunk.map((payer) => () => {
      const classList = payer.classes
        .map(
          (c, idx) =>
            `  ${idx + 1}. ${c.className} (id: ${c.classId})${c.classDescription ? ` -- ${c.classDescription}` : ''}`,
        )
        .join('\n')
      const classIdsCsv = payer.classes.map((c) => c.classId).join(', ')

      const prompt = `You are researching REAL, CURRENT formulary coverage for ONE payer of the FirstPassRx app, covering ${state}.

PAYER: ${payer.payerName} (id: ${payer.payerId})
Known formulary source to start from: ${payer.payerFormularyUrl}${payer.payerFormularyLabel ? ` ("${payer.payerFormularyLabel}")` : ''}
${payer.payerPbm ? `PBM: ${payer.payerPbm}` : ''}

You must cover ALL of these drug classes for this ONE payer, from a SINGLE fetch of the source
above (most state/commercial/Medicare formularies cover many drug classes in one document) --
do NOT fetch the source once per class:
${classList}

TASK
1. Fetch the known source above ONCE. If it 403s a plain fetch, note it and try WebSearch for the
   current, correct formulary/PDL/PA-policy document for this exact payer from a reputable origin
   (the payer's own domain, its PBM's domain, or a *.gov site). Never invent a URL — only cite a
   page you actually fetched with real, on-topic content. A 200 response is not proof; confirm the
   page's own caption (publisher, plan/product name, effective/revision date) actually matches this
   payer.
2. For EACH drug class listed above, read that class's section and extract:
   - The single PREFERRED agent: generic name, brand (or null if generic-preferred), whether a
     generic/biosimilar exists, a representative strength, and standard directions (sig, a short
     EHR-paste form, and a plain-language version).
   - Whether brand-over-generic (BOGL) is active for it, and why, if so.
   - ALTERNATIVES: other agents in this class that are still covered (not the top pick, not a
     barrier) -- each with a short note like "preferred, no PA" or "Tier 2". A drug that costs more
     (higher tier / non-preferred cost-sharing) but is still covered belongs HERE, never in
     paRequired.
   - PA-REQUIRED / STEP-THERAPY / NON-FORMULARY items: every other named agent in this class that
     is NOT clean-covered, each tagged with the correct outcome ('pa' | 'step' | 'nonformulary') and
     a short reason. Do NOT put "higher tier but still covered" items here.
   - The formulary TIER / insurance-cost statement for the preferred agent, if the source states
     one (a tier/copay-LEVEL description, e.g. "Tier 1 - preferred generic", never a dollar amount).
   - Whether the preferred agent ITSELF carries a restriction (PA/step even for the top pick) --
     capture that separately if so.
   - Any class-wide step-therapy criterion (e.g. "PA required if 2+ concurrent agents in class").
3. Be honest about verification, per class:
   - "verified" -- you read the preferred agent + the key restriction directly off the cited
     document, with its effective date visible.
   - "partial" -- the cited formulary is the correct, current source but a specific value is
     inferred rather than read verbatim.
   - "example" -- you could not reach a real source for this payer after trying WebSearch too;
     never fabricate a fake preferred agent -- say so plainly and mark "example" for every class.

For EACH class in the list above, write a checkpoint file
"data-gathering/${stamp}/${payer.payerId}-<classId>.json" (create the directory if it does not
exist) BEFORE you return anything, with exactly this shape (one file per classId: ${classIdsCsv}):

{
  "payerId": "${payer.payerId}",
  "classId": "<the class id this file covers>",
  "preferredAgent": {
    "inn": "string", "brand": "string or null", "genericAvailable": true or false,
    "strength": "string", "sig": "string", "sigShort": "string", "plainSig": "string"
  },
  "preferredRestriction": "string or null",
  "boglActive": true or false,
  "boglNote": "string or null",
  "alternatives": [ { "drug": "string", "note": "string" } ],
  "paRequired": [ { "drug": "string", "outcome": "pa|step|nonformulary", "reason": "string" } ],
  "stepTherapy": "string or null",
  "tier": "string or null",
  "verification": "verified|partial|example",
  "verificationNote": "one detailed paragraph: exact page/section read, effective date, what is confirmed vs inferred",
  "primarySource": {
    "url": "the exact URL you actually fetched/read",
    "label": "document title as shown on the page",
    "publisher": "publisher name",
    "effectiveDate": "YYYY-MM-DD or null"
  },
  "lastReviewed": "${today}"
}

Then return an ARRAY of all ${payer.classes.length} JSON objects (one per class) as your final
answer (as JSON text, not prose).`

      return agent(prompt, {
        phase: 'Gather',
        label: `${payer.payerId} (${payer.classes.length} classes)`,
        agentType: 'general-purpose',
      })
    }),
  )
  results.push(...chunkResults)
  log(`${state}: gathered ${Math.min(i + 2, payerTasks.length)}/${payerTasks.length} payers`)
}

return results.filter(Boolean).flat()
