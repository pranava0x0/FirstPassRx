// Single source of truth for the formulary data shape.
// src/data/formulary.json is validated against these types at load time
// (src/lib/formulary.ts) so a malformed PR fails loud, not silent.

// Ids are guide-scoped now — each guide declares its own payers and classes — so these are
// open strings validated at load (src/lib/formulary.ts) rather than a fixed union. The aliases
// stay for readability at call sites that pass a payer/class id around.
export type ClassId = string

export type PayerId = string

export type SourceType = 'gov' | 'payer' | 'pbm' | 'manufacturer' | 'guideline' | 'reference'

/**
 * How well a cell is backed by its cited source:
 *  - verified: the preferred agent + key restriction were read directly off the cited document.
 *  - partial:  the cited formulary is the correct, current source, but the exact value is inferred.
 *  - example:  illustrative; the source is the right formulary family but the value is unconfirmed.
 */
export type Verification = 'verified' | 'partial' | 'example'

/** A citable source. Every claim in the app points at one or more of these. */
export interface Reference {
  id: string
  label: string
  publisher: string
  type: SourceType
  url: string
  /** The document's own effective/revision date, if shown. */
  effectiveDate?: string
  /** When we captured it (ISO date). Distinct from effectiveDate (CLAUDE.md). */
  accessed: string
}

/** A plain-language definition for a clinical term, shown on a dotted-underline tap. */
export interface GlossaryTerm {
  term: string
  short: string
  definition: string
  sourceIds?: string[]
}

export interface PayerMeta {
  id: PayerId
  name: string
  shortName: string
  /** Plain-language note a patient recognizes ("a.k.a. …"). */
  aka?: string
  /** Pharmacy benefit manager, when known (drives where PA actually routes). */
  pbm?: string
  formularyUrl: string
  paPolicyUrl?: string
  sourceIds: string[]
}

export interface ClassMeta {
  id: ClassId
  /** Clinical label, e.g. "ICS/LABA (Combo)". */
  name: string
  /** Compact label for the selector. */
  shortName: string
  /** Plain-language label a patient understands, e.g. "Daily combo controller". */
  plainName: string
  /** Clinical one-liner. */
  description: string
  /** Patient-language one-liner. */
  plainDescription: string
  /** What it treats, e.g. "Asthma & COPD" or "COPD only". */
  indication?: string
  comingSoon?: boolean
  sourceIds: string[]
}

export interface PreferredAgent {
  /** Generic / chemical name, e.g. "Budesonide/formoterol". */
  inn: string
  /** Brand name, or null if prescribed generically. Required when boglActive is true. */
  brand: string | null
  genericAvailable: boolean
  /** Strength string, e.g. "160/4.5 mcg". */
  strength: string
  /** Clinical directions for display, e.g. "2 puffs twice daily". */
  sig: string
  /** Shorthand directions for EHR paste, e.g. "2 puffs BID". */
  sigShort: string
  /** Plain-language reading a patient understands, e.g. "two puffs, morning and night". */
  plainSig: string
}

/** A drug that won't ship clean for this payer/class, with the reason it rejects. */
export interface PaItem {
  drug: string
  /** Short reason tag, e.g. "PA required", "Step therapy", "Non-formulary", "Higher tier". */
  reason: string
}

/** Another in-class agent that IS covered (besides the first-pass pick) — the rest of the ladder. */
export interface AltItem {
  drug: string
  /** Why it's still fine to prescribe, e.g. "preferred · no PA", "Tier 2", "generic". */
  note?: string
}

export interface FormularyRecord {
  payerId: PayerId
  classId: ClassId
  preferredAgent: PreferredAgent
  boglActive: boolean
  boglNote: string | null
  /** Other covered agents in this class (the middle of the coverage ladder). Optional. */
  alternatives?: AltItem[]
  paRequired: PaItem[]
  stepTherapy: string | null
  verification: Verification
  /** One line on what is and isn't confirmed for this cell. */
  verificationNote: string
  sourceIds: string[]
  lastReviewed: string
}

/** Global app meta — shared across every guide. */
export interface AppMeta {
  title: string
  disclaimer: string
  version: string
  /** Which guide loads first (must match a guides[].id). */
  defaultGuideId: string
}

/**
 * One self-contained guide = a region × therapeutic area, with its own payers, classes,
 * data, sources, and the copy that makes the masthead/labels read right for that domain.
 * The top-level toggle swaps between guides.
 */
export interface Guide {
  id: string
  /** Short label for the top-level toggle, e.g. "MA · Inhalers". */
  label: string
  /** Region/jurisdiction, e.g. "Massachusetts". */
  region: string
  /** Therapeutic area shown in the masthead, e.g. "inhaler guide". */
  topic: string
  /** Legend for the class selector, e.g. "Inhaler type" / "Hormone type". */
  classNoun: string
  /** Singular noun for a product in this guide, e.g. "inhaler" / "medication". Used in patient copy. */
  unitNoun: string
  /** Masthead one-liner, e.g. "Pick a plan and inhaler class. Start with the green answer." */
  tagline: string
  dataStatus: 'sample' | 'mixed' | 'verified'
  lastUpdated: string
  /** When the dataset was captured against its sources. */
  capturedAt: string
  payers: PayerMeta[]
  classes: ClassMeta[]
  references: Reference[]
  glossary: GlossaryTerm[]
  records: FormularyRecord[]
}

export interface Formulary {
  meta: AppMeta
  guides: Guide[]
}
