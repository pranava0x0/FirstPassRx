# PR 2 review feedback

Resolved before merge:

1. **Clinical recommendation boundary.** The card now says “Formulary first-pass,” explicitly says
   that this is not a clinical recommendation, and no longer renders dosing or paste-ready Rx text.
2. **Benefit-product identity.** Every payer row now requires `productName`, `marketSegment`, and
   `formularyId`; the selector and result show the exact represented product.
3. **Adjudication semantics.** `paRequired` contains only typed PA, step-therapy, or non-formulary
   barriers. Higher-tier and non-preferred covered drugs moved to alternatives.
4. **Claim-specific provenance.** Each record separates `coverageSourceIds` from
   `restrictionSourceIds`; the options and barrier sections link to their supporting documents.
5. **Live tracing.** The trace tool sends preferred and alternative drugs to coverage sources and
   barrier/step/BOGL terms to restriction sources instead of checking only the preferred drug.
6. **Archive collisions.** State-index archive ids now include a stable SHA-256 URL digest, with a
   regression test for identical trailing paths.

The static validator and test suite enforce these boundaries so a future data refresh fails loud.
