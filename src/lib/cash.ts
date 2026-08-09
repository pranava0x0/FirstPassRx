// Vendor URLs must use canonical medication names, not the clinical labels shown in the UI.

/** Ceiling on covered-drug names with no explicit cash-link rule (see issues.md) -- a ceiling,
 * not a target: it must never grow silently. Shared by cash.test.ts and validate-prices.mjs so
 * the two never drift out of sync with each other. Raised 72 → 148 on 2026-07-02 when the VA
 * diabetes guide shipped (8 payers × 4 classes) with no cash-link rules yet -- adding rules for
 * the diabetes drugs (metformin, GLP-1s, SGLT2s, insulins) is a logged backlog item. Raised
 * 148 → 161 on 2026-07-05 when the ny-nsaids and il-nsaids guides shipped (1 payer × 1 class
 * each) with no cash-link rules yet -- oral NSAIDs are mostly cheap OTC-adjacent generics, but
 * adding real GoodRx/Cost Plus rules for naproxen/ibuprofen/meloxicam/celecoxib/diclofenac is a
 * logged backlog item. Raised 161 → 168 the same day when a PR review (codex bot) caught the
 * il-nsaids cell misclassifying several preferred drugs (Etodolac, Flurbiprofen, Ketoprofen) as
 * PA-required -- correcting the cell against the source PDL surfaced additional real preferred
 * drug names (Indomethacin, Ketorolac, Nabumetone, Sulindac) that also have no cash-link rule.
 * Raised 168 → 232 on 2026-07-06 when the ny-ace and ny-nsaids guides gained 4 new payers each
 * (Excellus BCBS, UnitedHealthcare, Anthem BCBS NY, Excellus Medicare) -- each payer's own
 * formulary names its own long tail of ACE-inhibitor/NSAID brand and generic-form variants
 * (ALTACE, VASOTEC, ZESTRIL, LOTENSIN family; CELEBREX, ANAPROX DS, NAPROSYN, RELAFEN, FELDENE,
 * DAYPRO, EC-NAPROSYN, diclofenac submicronized, etc.) that the existing 20-drug cash.ts ruleset
 * has no entry for. Adding real GoodRx/Cost Plus rules for these is a logged backlog item.
 * Lowered 232 → 219 on 2026-07-06 (same day): added real GoodRx rules for all 8 remaining
 * ma-inhalers drugs (Dulera, Incruse Ellipta, Arnuity Ellipta, Yupelri, Tudorza Pressair, Asmanex
 * Twisthaler, Alvesco, QVAR RediHaler), captured via a real browser session. None of the 8 had a
 * Cost Plus Drugs match (searched each generic name -- Cost Plus doesn't carry any of these
 * specialty inhalers/devices, only the combo or topical/nasal forms of a couple of their
 * components), so those rules are GoodRx-only by design, not an oversight. md-menopause (59),
 * ny-nsaids (66), va-diabetes (76, currently zero priced), and il-nsaids (12) remain open --
 * logged in issues.md/backlog.md.
 * Raised 219 → 235 on 2026-07-06 (same day) when the new `va-ace` guide shipped (8 payers, 1
 * class, reusing VA's existing payer roster) -- the non-preferred/non-formulary ACE inhibitors
 * (captopril, fosinopril, moexipril, perindopril, quinapril, trandolapril, plus their brand and
 * combo-product name variants) have no cash-link rule yet. Adding them would also help the
 * existing `ny-ace` guide, which has the same gap for the same drugs -- logged as one combined
 * backlog item rather than two.
 * Raised 235 → 401 on 2026-07-06 (same day) when 3 brand-new NY guides shipped (`ny-inhalers`,
 * `ny-menopause`, `ny-diabetes`; 5 payers each, 13 classes total) -- each payer's own formulary
 * names its own long tail of inhaler/HT/diabetes brand and generic-form variants with no
 * cash-link rule yet (this mirrors the exact same "new guide surfaces a new drug-name long tail"
 * pattern as every prior raise above, just at 3x the guides in one merge). Adding real GoodRx/
 * Cost Plus rules for these is a logged backlog item alongside the existing md-menopause (59),
 * ny-nsaids (66), va-diabetes (76, still zero priced), and il-nsaids (12) gaps.
 * Raised 401 → 681 on 2026-07-07 when 4 brand-new MD guides shipped (`md-inhalers`, `md-ace`,
 * `md-diabetes`, `md-nsaids`; 8 payers each). Most of the increase (~150 names) came from a
 * `validate()`-driven fix, not new coverage: several cost-tier-only items were reclassified from
 * `paRequired` to `alternatives` (see issues.md) -- `coveredDrugNames()` only counts
 * `preferredAgent`/`alternatives`, never `paRequired`, so correctly reclassifying a drug as
 * "still covered, just pricier" makes it newly count toward this gap. That's the honest, expected
 * outcome of the fix, not a regression to paper over.
 * Raised 681 → 684 on 2026-07-07 (same day) when 3 brand-new VA guides shipped (`va-inhalers`,
 * `va-menopause`, `va-nsaids`; 8 payers each, reusing VA's known roster). Only 3 new names this
 * time (not ~150 like MD) because VA reuses the same inhaler/menopause/NSAID drug-name universe
 * already priced or logged as a gap for MA/NY/MD -- the marginal new names are payer-specific
 * brand variants (e.g. DUAVEE moved to alternatives, a few uhc-community brand-tier duplicates).
 * Raised 684 → 808 on 2026-07-07 (same day) when 4 brand-new MA guides shipped (`ma-ace`,
 * `ma-diabetes`, `ma-menopause`, `ma-nsaids`; 5 payers each). Unlike the VA raise above, this is a
 * large jump (+124) because it's MA's *first* diabetes and full menopause-HT coverage -- each of
 * MassHealth/BCBSMA/Tufts/Harvard Pilgrim/MGB names its own long tail of insulin/GLP-1/SGLT2 and
 * estrogen-product brand variants the existing ruleset has no entry for, the same "new drug-class
 * long tail" pattern as the original NY/MD raises above, not a `validate()`-fix artifact this time
 * (only ~16 items were reclassified `paRequired` -> `alternatives` here, most of the increase is
 * genuinely new covered-drug names).
 * Raised 808 → 1088 on 2026-07-07 (same day) when 4 brand-new IL guides shipped (`il-inhalers`,
 * `il-ace`, `il-diabetes`, `il-menopause`; 8 payers each) plus `il-nsaids` expanded from 1 payer
 * to 8. This is IL's first depth beyond a single FFS payer for every topic, so 5 brand-new
 * Medicaid MCOs (Aetna Better Health of Illinois, Blue Cross Community Health Plans, CountyCare,
 * Meridian, Molina) each name their own long tail of inhaler/ACE/diabetes/HRT/NSAID brand and
 * generic-form variants the existing ruleset has no entry for -- the same "new payer roster
 * surfaces a new drug-name long tail" pattern as every prior raise above, now at IL's full
 * 8-payer depth in one merge.
 * Lowered 1088 → 633 on 2026-07-09: added real GoodRx/Cost Plus rules for every diabetes
 * (metformin, dapagliflozin, empagliflozin, insulin glargine/lispro/degludec, dulaglutide,
 * liraglutide, semaglutide oral + injectable) and NSAID (naproxen, ibuprofen, meloxicam) preferred
 * agent -- the 177-cell preferred-agent gap the validation run surfaced, which also swept up ~278
 * of these same drugs' alternative-list names across all 5 states. Prices captured off a real
 * browser session (see the rule block below). Remaining 633 is the long tail of brand/generic-form
 * variants in alternatives lists (HRT products, ACE/inhaler brand variants) -- a logged backlog
 * item, not a preferred-agent gap.
 * Lowered 633 → 537 on 2026-07-09 (same session): priced the last 7 non-diabetes/NSAID
 * preferred-agent stragglers (vaginal estradiol, ipratropium, oral conjugated estrogens), so
 * EVERY one of the 510 state×class preferred-agent cells now carries a captured price. The
 * remaining long tail is purely alternatives-list HRT/ACE/inhaler brand & generic-form variants
 * -- logged in backlog.md, not a headline-recommendation gap.
 * Lowered 537 → 509 on 2026-07-09 (same session): broadened the existing micronized-progesterone
 * rule's matcher to catch the bare "progesterone" inn (3 progestogen cells the UI resolves by inn
 * alone showed link-only), which also swept up progesterone brand variants in alternatives. Every
 * preferred-agent cell now prices by inn-only lookup -- the exact path ResultCard/PrescribeOptions
 * use.
 * Raised 509 → 541 on 2026-07-09 (code-review fix, same session): the metformin rule was catching
 * ~32 multi-ingredient combo names (Synjardy/Xigduo/Trijardy/glipizide-metformin/...) and pricing
 * them as cheap plain metformin ($29.63) -- badly wrong for $300-600 brand combos. Added a combo
 * negative-lookahead so those fall through to the SGLT2 rules (reasonable proxy) or the no-price
 * fallback instead. Every combo dropped here was an *alternatives*-list name, never a preferred
 * agent, so all 510 preferred-agent cells still price. Correctness raise (we stopped mispricing),
 * not a coverage regression -- same category as the MD paRequired→alternatives raises above.
 * Raised 541 → 575 on 2026-07-09 (Codex PR review, same session): same combo/form-mismatch class
 * caught in two more matchers -- (1) the broadened progesterone rule was pricing non-oral forms
 * (Crinone vaginal gel, vaginal suppository, Endometrin insert, injection oil) and the Bijuva
 * estradiol/progesterone combo as the 100mg oral capsule; (2) the glargine rule matched the Soliqua
 * glargine-lixisenatide fixed-dose combo and priced it as Lantus $35. Both now excluded via negative
 * lookahead so they fall through instead of showing a confident wrong price. Again all
 * preferred-agent cells still price; the raise is dropped alternatives-list mispricings.
 * Lowered 575 → 362 on 2026-07-16: added rules for the ~19 "second-tier" oral NSAID molecules
 * (celecoxib, diclofenac potassium/sodium-ER/topical/misoprostol-combo, etodolac, flurbiprofen,
 * indomethacin, ketoprofen/ketoprofen-ER, ketorolac, meclofenamate, mefenamic acid, nabumetone,
 * oxaprozin, piroxicam, sulindac, diflunisal, tolmetin, salsalate, aspirin) that had zero
 * cash-link rule at all -- referenced under ~200 different verbatim phrasings across the 5 NSAID
 * guides (one per source PDF's own wording for the same drug), the same "new guide surfaces a new
 * long tail" pattern as every raise above, just discovered via a user UAT screenshot instead of a
 * new-guide merge. Cost Plus prices are real (captured 2026-07-16); GoodRx prices are mostly
 * still missing -- GoodRx served a real "Press & Hold" bot-check CAPTCHA to this session after one
 * successful lookup, a harder block than the usual plain-fetch 403 this project has seen before.
 * Revisit to fill in GoodRx once accessible; meclofenamate/salsalate/immediate-release-ketoprofen
 * are confirmed not carried by Cost Plus (not a research gap).
 * Lowered 362 → 76 the same day, continuing the same UAT sweep across ACE inhibitors (captopril,
 * fosinopril, moexipril, perindopril, quinapril, trandolapril, fosinopril-HCTZ, trandolapril-
 * verapamil, sacubitril/valsartan), inhalers (Anoro, Perforomist, terbutaline, montelukast,
 * mometasone/Nasonex, flunisolide, Breyna, bare "fluticasone" phrasings; Striverdi/Bevespi/Seebri/
 * Duaklir/Trelegy/Breztri/Serevent/metaproterenol/epinephrine confirmed not carried), diabetes
 * (exenatide, glipizide/glyburide/glimepiride/pioglitazone + their metformin/glimepiride combos,
 * sitagliptin + Janumet, Xigduo XR, the entire insulin-brand family confirmed not carried by Cost
 * Plus -- NovoLog/Humulin/Novolin/Fiasp/Levemir/Lyumjev/Soliqua/Merilog, matching this file's
 * existing "Cost Plus doesn't carry insulins" finding -- plus Mounjaro/tirzepatide, Invokana/
 * canagliflozin, Synjardy/Trijardy/Glyxambi, alogliptin-metformin, saxagliptin-metformin all
 * confirmed not carried), and menopause-HT (Prempro, Premphase, Duavee, megestrol). Also fixed 3
 * regex precedence bugs that silently required a generic name to co-occur with a brand name
 * (bare "DIVIGEL"/"ESTROGEL"/"ELESTRIN", "ALORA", "MENOSTAR" without "estradiol" alongside them
 * fell through), a bare "IBU" abbreviation, and a bare "Glucophage" brand mention. The remaining
 * 76 were entirely menopause-HT and almost entirely confirmed not carried by Cost Plus (Femring,
 * Bijuva, Crinone, Depo-Estradiol, Osphena, Endometrin, injectable/vaginal progesterone, estradiol
 * valerate IM).
 * Lowered 76 → 0 the same day: confirmed by direct search that every remaining name (Evamist,
 * Depo-Estradiol, Crinone, Femring, Endometrin, injectable/vaginal progesterone, Intrarosa,
 * Osphena, Menest/Estratest/EEMT/Covaryx, Angeliq, Bijuva, Prefest, Estring, estradiol valerate
 * IM, estropipate) is genuinely not carried by Cost Plus -- gave each its own explicit rule
 * (GoodRx slug set, no price yet) instead of leaving them to the fallback slug guesser. Also
 * closed real gaps found along the way: Abigale/Gallifrey/Zafemy are branded generics of the same
 * estradiol/norethindrone acetate combo as Activella (added to that existing rule, same real
 * price); "norethindrone 5 mg tablet" is the acetate-salt strength without the word "acetate" in
 * the source phrasing (broadened the existing norethindrone-acetate rule); Premarin's rule only
 * matched "conjugated estrogen" in that literal word order, so "estrogens conjugated" (reversed --
 * used by several sources) fell through entirely, AND Cost Plus does carry Premarin (the old
 * rule's "doesn't carry it" comment was wrong for the 0.3mg tablet, only correct for the 0.625mg
 * strength the existing GoodRx rule cited).
 * **Every covered drug name in the live formulary now has an explicit cash-link rule** (0
 * unmatched, down from 575 this morning). Not every rule has a captured price yet: GoodRx is
 * still pending for ~380+ molecules priced only via Cost Plus this session (a real, harder
 * "Press & Hold" bot-check blocked repeated attempts, see the note above) -- fill those in a
 * future session once GoodRx access is reliable again, not by guessing. ~314 names are
 * confirmed-not-carried-by-either-vendor link-only by design (brand insulins, brand GLP-1s, most
 * of the menopause-HT long tail) and won't get a price without a 3rd vendor.
 * 2026-07-18: +33 for the new `ny-ssris` guide (sertraline/citalopram/escitalopram/fluoxetine/
 * paroxetine/fluvoxamine name variants across 5 payers) -- a scheduled/headless run has no human
 * to clear GoodRx's "Press & Hold" bot-check, so no cash-link rules were added this session (see
 * backlog.md). All 33 are cheap, long-generic SSRIs a future browser session should price
 * quickly, same pattern as the diabetes/NSAID gap closure.
 * 2026-07-21: +27 for `ma-ssris` (60 total) -- same 6 SSRI molecules, more free-text alternative-
 * name variants per payer. The SSRI expansion to MD/VA/IL will add more variants of these same
 * molecules; deferred to one consolidated cash-link-rule pass (backlog.md) rather than guessing
 * mid-expansion, since the same 6 molecule names recur across every state.
 * 2026-07-21 (cont.): +42 for `md-ssris` (102 total), same reason.
 * 2026-07-21 (cont.): +35 for `va-ssris` (137 total), same reason.
 * 2026-07-21 (cont.): +57 for `il-ssris` (194 total), same reason. SSRI expansion (ny/ma/md/va/il)
 * now complete; a future browser session should add ~6 broad regex cash-link rules (one per
 * molecule: sertraline/citalopram/escitalopram/fluoxetine/paroxetine/fluvoxamine) to collapse
 * most of this 194 in one pass, same as the metformin/lisinopril-family rules already do for
 * their molecules -- see backlog.md.
 * 2026-07-21 (cont.): +33 for `ny-osteoporosis` (227 total) -- first osteoporosis guide, new
 * generics (alendronate/risedronate/ibandronate/zoledronic acid/denosumab/teriparatide/
 * abaloparatide/romosozumab/raloxifene) and their brand/biosimilar variants, same headless-run
 * GoodRx bot-block as every other scheduled gather. Deferred to the same future consolidated
 * cash-link-rule pass as the SSRI gap above.
 * 2026-07-21 (cont.): +30 for `ma-osteoporosis` (257 total), same reason -- more free-text
 * alternative-name variants of the same osteoporosis molecules across MassHealth/BCBSMA/Tufts/
 * Harvard Pilgrim/MGB.
 * 2026-07-21 (cont.): +35 for `md-osteoporosis` (292 total), same reason -- 8 payers' worth of
 * denosumab-biosimilar and teriparatide/abaloparatide/romosozumab name variants.
 * 2026-07-21 (cont.): +35 for `va-osteoporosis` (327 total), same reason -- 8 more payers'
 * worth of biosimilar/brand name variants (Bildyos, Bilprevda, Jubbonti, Stoboclo, Conexxence,
 * Enoby, Bosaya, Ospomyv).
 * 2026-07-22: +12 for `il-osteoporosis` (339 total) -- 8th and final osteoporosis-guide payer
 * roster (il-medicaid/aetna-better-health-il/bcbs-community-il/countycare/meridian/molina-il/
 * bcbs-illinois-commercial/wellcare-value-script), same headless-run GoodRx bot-block. Completes
 * osteoporosis's 5-state footprint (matching SSRIs). Deferred to the same future consolidated
 * cash-link-rule pass as the SSRI gap above.
 * 2026-07-23: +12 for `al-ssris` (351 total) -- first new-state guide (Alabama), 3 payers
 * (al-medicaid/bcbs-al-commercial/bcbs-al-medicare), headless run so GoodRx/Cost Plus stayed
 * bot-blocked same as every prior scheduled-run gather.
 * 2026-07-25: +10 for AL's remaining 6 topics (al-inhalers/al-menopause/al-ace/al-diabetes/
 * al-nsaids/al-osteoporosis, 361 total) -- same 3-payer AL roster, same headless-run GoodRx/Cost
 * Plus block. Osteoporosis's bisphosphonate/denosumab/teriparatide brand-name variants account for
 * the jump; the other 5 AL topics' drug names mostly matched existing molecule-family regex rules.
 * 2026-07-26: +16 for `pa-ssris` (377 total) -- first Pennsylvania guide (proof guide for the
 * PA new-state expansion), 3 payers (pa-medicaid/ibx-commercial/highmark-bcbs), headless run so
 * GoodRx/Cost Plus stayed bot-blocked same as every prior scheduled-run gather.
 * Lowered 377 → 155 on 2026-07-29: a real browser session was available this scheduled run (rare
 * for a headless/scheduled invocation -- GoodRx wasn't bot-blocked at the start of the session).
 * Added the 6 broad SSRI molecule rules flagged as future work in the 2026-07-21 note above
 * (sertraline/citalopram/escitalopram/fluoxetine/paroxetine/fluvoxamine), which collapsed every
 * SSRI name variant across all 7 shipped SSRI guides (NY/MA/MD/VA/IL/AL/PA) in one pass -- the
 * same molecule-family-regex leverage the metformin/lisinopril rules already have. GoodRx served
 * a "Press & Hold" bot-check partway through (paroxetine/fluvoxamine came back Cost-Plus-only);
 * osteoporosis's molecule families (bisphosphonates/denosumab/teriparatide/raloxifene, flagged in
 * the same 2026-07-21 note) remain unpriced -- a good target for the next session with browser
 * access.
 * Lowered 155 → 129 on 2026-07-30: another real browser session was available. Added alendronate
 * (oral-bisphosphonate) and raloxifene (serm) -- the two osteoporosis preferred-agent molecules
 * Cost Plus actually carries (checked its bone-health category directly: no listing for zoledronic
 * acid/Reclast, denosumab/Prolia, teriparatide/Forteo, or abaloparatide/Tymlos -- specialty
 * infusions/injectables, not stocked). GoodRx then hit a session-wide "Access to this page has been
 * denied" block (not per-page, like the intermittent "Press & Hold" check -- every subsequent
 * lookup failed) before those 4 specialty-injectable molecules could even attempt a GoodRx-only
 * capture -- logged to backlog.md as the remaining osteoporosis cash-price gap.
 * Lowered 129 → 90 on 2026-08-02: another real browser session was available, no vendor block at
 * the start. Added denosumab/Prolia (rankl-inhibitor) -- GoodRx's bare `prolia` slug landed on the
 * exact right product by default (1 syringe, 60 mg/mL, osteoporosis strength), unlike Reclast (see
 * next). GoodRx then hit the same session-wide "Access to this page has been denied" block as
 * 2026-07-30, this time after only 2 lookups: (1) Prolia (captured, correct strength) and (2)
 * zoledronic acid/Reclast, which the bare slug defaulted to the WRONG product (4mg/5mL Zometa
 * oncology-dosing vial, not the 5mg/100mL Reclast once-yearly osteoporosis infusion -- different
 * drug/price in practice) -- that wrong-strength price was discarded, not shipped. Teriparatide/
 * Forteo and abaloparatide/Tymlos were never reached before the block. Remaining gap: zoledronic
 * acid/Reclast (needs the Edit-flow or a correct dosage param, not the bare slug -- see
 * backlog.md), teriparatide/Forteo, abaloparatide/Tymlos.
 * Lowered 90 → 78 on 2026-08-04: GoodRx was session-wide blocked from the first lookup (no grace
 * period at all this time), but a routine re-check of Cost Plus Drugs' catalog (last checked
 * 2026-07-30) found it had added teriparatide/Forteo/Bonsity since then -- a real catalog change,
 * not a missed search. Cost-Plus-only rule added (see below), same shape as the paroxetine/
 * fluvoxamine SSRI rules. Remaining gap: zoledronic acid/Reclast, abaloparatide/Tymlos -- neither
 * is Cost-Plus-carried (re-confirmed 2026-08-04) and GoodRx access is still needed for both.
 * Raised 78 → 90 on 2026-08-05: merging PA's remaining 20 classes (inhalers/ace/diabetes/
 * menopause/nsaids/osteoporosis) introduced 3 osteoporosis molecule families never seen in any
 * prior guide's alternatives lists -- risedronate (Actonel/Atelvia), ibandronate (Boniva), and
 * pamidronate (IV) -- none had an explicit cash-link rule yet (only alendronate/zoledronic
 * acid/denosumab/teriparatide/raloxifene do). Also added a handful of one-off new names:
 * abaloparatide/Tymlos and romosozumab/Evenity (already-known gaps, now also appearing as PA
 * alternatives), VoSpire ER, Apidra/Admelog (rapid-acting insulin brand variants), and a plain
 * "Norethindrone Tablet (generic)" phrasing. Headless run, no browser access -- logged the
 * molecule-family targets to backlog.md rather than guessing prices.
 * Lowered 90 → 29 on 2026-08-05 (same day, later): fixed the "Norethindrone Tablet (generic)"
 * gap by narrowly broadening the existing norethindrone-acetate rule (this app has no
 * contraception class, so a bare "norethindrone tablet" here is always the endometrial-protection
 * acetate dose). Added real Cost Plus prices for risedronate/Actonel (30 tablets, 5mg daily-dose,
 * $31.54) and ibandronate/Boniva (dose-pack of 3, 150mg once-monthly, $8.51) -- both collapse
 * across every osteoporosis guide shipped so far, not just PA. GoodRx was session-wide "Access to
 * this page has been denied" blocked from the first lookup (5th consecutive session with this
 * exact block), so both are Cost-Plus-only this pass. The ibandronate rule excludes any name
 * mentioning iv/injection/injectable/syringe/vial -- several covered names explicitly describe IV
 * ibandronate (a real, distinct, unpriced product Cost Plus does not carry), and pricing those as
 * the cheap oral tablet would have been a route-of-administration mispricing bug, same category as
 * the Reclast/Zometa and Respimat/HandiHaler traps already documented in CLAUDE.md. Remaining gap,
 * all confirmed not-Cost-Plus-carried this session, GoodRx-blocked: zoledronic acid/Reclast,
 * pamidronate (IV only), abaloparatide/Tymlos, romosozumab/Evenity, etidronate disodium, VoSpire
 * ER, Apidra/Admelog (rapid-acting insulin brands), and IV-route ibandronate mentions (intentional
 * exclusion, see above).
 * 29 → 33 on 2026-08-05 (same day, later, after ca-* guides merged): closed 2 pre-existing gaps
 * that CA happened to newly exercise (a bare "Estradiol vaginal"/"estradiol (vaginal)" phrasing
 * with no "tablet"/"insert" word -- broadened the existing Yuvafem/vaginal-insert rule; a plain
 * "estradiol N mg ... tablets" phrasing lacking the word "oral" -- broadened the existing oral
 * rule). Two genuinely new, confirmed-not-Cost-Plus-carried gaps: fenoprofen (Nalfon, an NSAID)
 * and plain regular human insulin (Humulin R/Novolin R-equivalent) -- both searched directly,
 * neither returned a real product. Net: 35 raw CA-introduced unmatched names → 33 after the two
 * regex fixes.
 * 2026-08-09 (scheduled run): GoodRx access recovered mid-session after 7 consecutive sessions of
 * a hard block (started blocked, cleared after a couple of retries, then re-blocked again later in
 * the session -- confirmed intermittent, not a clean recovery). Captured 2 of the 3 remaining
 * osteoporosis specialty-injectable prices: zoledronic acid/Reclast ($81.49, correct 5mg/100mL
 * osteoporosis dose this time, not the wrong 4mg oncology dose GoodRx defaulted to on 2026-08-02 --
 * pinned with explicit params so a future session's default can't drift back) and abaloparatide/
 * Tymlos ($3,030, correct FDA-labeled 80mcg/dose pen strength). Romosozumab/Evenity and pamidronate
 * confirmed to have NO real GoodRx retail price at all (both "Physician-administered" tagged pages
 * with no pharmacy-price panel) -- not a research gap, a structural fact about how these
 * buy-and-bill-only infusions are actually dispensed; no rule added for either rather than fabricate
 * a number. Etidronate disodium never reached before GoodRx re-blocked. */
export const KNOWN_UNPRICED_GAP = 21

/** A snapshot cash price. Not live — see pricesCapturedAt. Deep-link (goodRxUrl/costPlusUrl) stays
 * the primary, current source; this is "as of" context only (CLAUDE.md: capture dates, don't bake
 * volatile numbers as fact). */
export interface PricePoint {
  price: number
  /** What the price is for, e.g. "1 inhaler", "30 tablets" — vendors quote different pack sizes. */
  quantity: string
}

interface CashLinkRule {
  matches: RegExp
  goodRxSlug: string
  /** Query string (no leading ?) that pins the GoodRx page to this rule's exact dosage, when the
   * plain slug page defaults to a different strength/form. Keeps the link and goodRxPrice consistent. */
  goodRxParams?: string
  costPlusPath?: string
  /** Standard (no-membership) GoodRx coupon price. Omitted when the vendor's page defaults to a
   * different strength/form than this rule and no exact-match page could be found. */
  goodRxPrice?: PricePoint
  /** Cost Plus Drugs "price with us". Omitted when out of stock or unavailable at capture time. */
  costPlusPrice?: PricePoint
  /** ISO date both prices above were read directly off the vendor page (real browser session,
   * not a secondary aggregator). */
  pricesCapturedAt?: string
}

const CASH_LINK_RULES: CashLinkRule[] = [
  {
    matches: /\balbuterol sulfate solution|albuterol.*nebul/i,
    goodRxSlug: 'albuterol',
    goodRxParams: 'label_override=albuterol&form=vial&dosage=3ml-of-0.63mg-3ml&quantity=25',
    costPlusPath: 'albuterol-sulfate-0_63mg-3ml-nebulization-solution-3-accuneb',
    goodRxPrice: { price: 34.43, quantity: '25 vials, 0.63mg/3mL' },
    costPlusPrice: { price: 14.64, quantity: 'box of 25 vials, 0.63mg/3mL' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /albuterol|proair|ventolin|proventil/i,
    goodRxSlug: 'albuterol',
    costPlusPath: 'albuterol-90mcg-inhaler18g',
    goodRxPrice: { price: 41.45, quantity: '1 HFA inhaler, 90mcg' },
    costPlusPrice: { price: 46.38, quantity: '1 HFA inhaler, 90mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /budesonide.*formoterol|symbicort|breyna/i,
    goodRxSlug: 'budesonide-formoterol',
    costPlusPath: 'budesonide-formoterol-fumarate-160-4_5mcg-act-aerosol-inhaler-10_2-symbicort',
    goodRxPrice: { price: 97.09, quantity: '1 inhaler, 160/4.5mcg, 120 doses' },
    costPlusPrice: { price: 204.61, quantity: '1 inhaler, 160/4.5mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /budesonide|pulmicort/i,
    goodRxSlug: 'budesonide',
    costPlusPath: 'budesonide-0_5mg_2ml-inhalation-suspension-60ml',
    goodRxPrice: { price: 48.30, quantity: '30 ampules, 0.5mg/2mL' },
    costPlusPrice: { price: 25.06, quantity: '0.5mg/2mL' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /fluticasone.*salmeterol|advair|wixela|airduo/i,
    goodRxSlug: 'fluticasone-salmeterol',
    costPlusPath: 'Fluticasone-Salmeterol-250mcg50mcg-Tablet',
    goodRxPrice: { price: 65.46, quantity: '1 diskus inhaler, 250/50mcg' },
    costPlusPrice: { price: 47.55, quantity: '250/50mcg, 60 doses' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /fluticasone furoate.*vilanterol|breo/i,
    goodRxSlug: 'breo-ellipta',
    costPlusPath: 'fluticasone-furoate-vilanterol-100-25-mcg_act-aerosol-powder-breath-activated-60',
    goodRxPrice: { price: 228.01, quantity: '1 inhaler, 100/25mcg, 60 blisters' },
    costPlusPrice: { price: 287.04, quantity: '100/25mcg, 60 blisters' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    // No Cost Plus match: searched "fluticasone furoate" -- only the furoate/vilanterol (Breo)
    // combo and fluticasone propionate forms are carried, not standalone furoate (Arnuity Ellipta).
    // Must sit after the Breo rule above (a real Breo match also contains "fluticasone furoate")
    // but before the bare "fluticasone" rule below, which would otherwise catch "fluticasone
    // furoate" (Arnuity) itself since it has no furoate-specific exclusion.
    matches: /arnuity|fluticasone furoate/i,
    goodRxSlug: 'arnuity-ellipta',
    goodRxPrice: { price: 137.1, quantity: '1 inhaler, 100mcg, 30 blisters' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // Broadened 2026-07-16 to catch bare "fluticasone"/"fluticasone DISKUS"/"nasal steroid form
    // only" phrasings -- safe because the salmeterol/furoate-vilanterol/furoate-alone rules above
    // this one in the array already intercept those more specific cases first.
    matches: /fluticasone|flovent/i,
    goodRxSlug: 'fluticasone',
    costPlusPath: 'fluticasone-propionate-hfa-110-mcg_act-inhaler-12',
    goodRxPrice: { price: 181.48, quantity: '1 HFA inhaler, 110mcg' },
    costPlusPrice: { price: 185.03, quantity: '1 HFA inhaler, 110mcg, 12g' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /levalbuterol|xopenex/i,
    goodRxSlug: 'levalbuterol',
    costPlusPath: 'levalbuterol-tartrate-45mcg_act-aerosol-inhaler-15',
    goodRxPrice: { price: 64.02, quantity: '1 inhaler, 45mcg, 15g' },
    costPlusPrice: { price: 54.78, quantity: '1 inhaler, 45mcg, 15g' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /tiotropium|spiriva/i,
    goodRxSlug: 'tiotropium',
    costPlusPath: 'tiotropium-bromide-inhalation-powder-18mcg-30-capsules',
    goodRxPrice: { price: 76.57, quantity: '30 capsules, 18mcg' },
    costPlusPrice: { price: 411.28, quantity: '30 capsules, 18mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  // ---- Remaining inhaler/respiratory alternatives (added 2026-07-16) ----
  // Same user UAT sweep as the NSAID/ACE blocks above. Cost Plus prices are real, captured
  // 2026-07-16; GoodRx omitted (pending -- see the NSAID block's note on the session-wide
  // "Press & Hold" bot-check).
  {
    matches: /umeclidinium.*vilanterol|anoro/i,
    goodRxSlug: 'anoro-ellipta',
    costPlusPath: 'umeclidinium-vilanterol-62_5-25-mcg_act-aerosol-powder-breath-activated-60',
    costPlusPrice: { price: 346.55, quantity: '62.5/25mcg, 60 doses' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Nebulizer solution, not the inhaled powder/aerosol forms above.
    matches: /formoterol(?!.*budesonide).*(?:solution|perforomist)|perforomist/i,
    goodRxSlug: 'formoterol',
    costPlusPath: 'formoterol-fumarate-20mcg-2ml-carton-of-solution-vials-2-perforomist',
    costPlusPrice: { price: 99.64, quantity: '20mcg/2mL, 2 vials' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /terbutaline/i,
    goodRxSlug: 'terbutaline',
    costPlusPath: 'terbutaline-sulfate-2_5mg-tablet-brethine',
    costPlusPrice: { price: 22.60, quantity: '2.5mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /montelukast|singulair/i,
    goodRxSlug: 'montelukast',
    costPlusPath: 'montelukast-10mg-tablet',
    costPlusPrice: { price: 5.79, quantity: '10mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /mometasone.*nasal|nasonex/i,
    goodRxSlug: 'mometasone',
    costPlusPath: 'mometasonefuroate-50mcg-suspension',
    costPlusPrice: { price: 23.47, quantity: '50mcg suspension' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /flunisolide|nasalide/i,
    goodRxSlug: 'flunisolide',
    costPlusPath: 'flunisolide-25mcg-act-0_025-nasal-spray-25-nasalide',
    costPlusPrice: { price: 57.98, quantity: '0.025% nasal spray, 25mL' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns no exact match); GoodRx pending.
    matches: /striverdi|olodaterol/i,
    goodRxSlug: 'striverdi-respimat',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns only unrelated oral/injectable glycopyrrolate,
    // not the inhaled device forms); GoodRx pending.
    matches: /seebri|bevespi|duaklir/i,
    goodRxSlug: 'bevespi-aerosphere',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns no exact match); GoodRx pending.
    matches: /trelegy/i,
    goodRxSlug: 'trelegy-ellipta',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns no exact match); GoodRx pending.
    matches: /breztri/i,
    goodRxSlug: 'breztri-aerosphere',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Serevent Diskus is salmeterol alone; Cost Plus only carries fluticasone-salmeterol combos
    // (confirmed by search), not the LABA-only product. GoodRx pending.
    matches: /serevent/i,
    goodRxSlug: 'serevent',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns only an unrelated fuzzy match -- a diabetes combo
    // product); GoodRx pending.
    matches: /metaproterenol/i,
    goodRxSlug: 'metaproterenol',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Auto-injector devices aren't carried by Cost Plus at all (search returns zero results);
    // GoodRx pending.
    matches: /epinephrine/i,
    goodRxSlug: 'epinephrine',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // "abigale|gallifrey|zafemy" added 2026-07-16: branded-generic manufacturer names for the same
    // estradiol/norethindrone acetate 0.5/0.1mg or 1/0.5mg combo as Activella -- Cost Plus doesn't
    // carry these specific brand names, but they're chemically identical, same strengths.
    matches: /estradiol.*norethindrone|activella|mimvey|amabelz|abigale|gallifrey|zafemy/i,
    goodRxSlug: 'activella',
    goodRxParams: 'label_override=estradiol-norethindrone&form=package&dosage=28-tablets-of-0.5mg-0.1mg&quantity=3',
    costPlusPath: 'estradiolnorethrindroneacetate-0_5mg0_1mg-blisterpack28pack',
    goodRxPrice: { price: 57.30, quantity: '28 tablets (3 packages), 0.5mg/0.1mg' },
    costPlusPrice: { price: 23.40, quantity: '28 tablets, 0.5mg/0.1mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    // "norethindrone[-\s]?(?:ac[-\s]?)?eth\b" added 2026-08-05 -- found via a full-formulary sweep
    // this session (not the original bug being fixed, but caught in passing): several sources
    // abbreviate "ethinyl" to "eth" or "ac-eth" ("norethindrone-eth estradiol", "Norethindrone
    // ac-eth estradiol oral tablet") -- none contain the literal phrase "ethinyl estradiol" this
    // rule otherwise requires, so they fell through to the plain oral-estradiol rule below and got
    // priced as single-agent estradiol ($34.18/$6.77) instead of this combo product's real price
    // -- a mispricing bug that predates this session's other edits.
    matches:
      /ethinyl estradiol.*norethindrone|norethindrone.*ethinyl estradiol|jinteli|fyavolv|femhrt|norethindrone[-\s]?(?:ac[-\s]?)?eth\b/i,
    goodRxSlug: 'jinteli',
    costPlusPath: 'norethindrone-acetate-ethinyl-estradiol-1mg-5mcg-pack-of-tablets-90-fyavolv',
    goodRxPrice: { price: 61.49, quantity: '28 tablets, 1mg/5mcg' },
    costPlusPrice: { price: 30.63, quantity: '90 tablets, 1mg/5mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    // Broadened 2026-08-05: several sources describe this product without the word "tablet"/
    // "insert" right after "vaginal" -- a bare "Estradiol vaginal" (pre-existing, several NY
    // guides) or CA's "estradiol (vaginal)" INN-field phrasing. First draft of this broadening
    // (word-boundary + a lookahead scoped only to text AFTER "vaginal") shadowed Estring/Femring/
    // Imvexxy -- e.g. "IMVEXXY (estradiol vaginal insert)" has the brand name BEFORE "vaginal", so
    // a lookahead anchored at the match point never saw it, and the string wrongly got this rule's
    // Vagifem-tablet price instead of falling through to Estring/Femring/Imvexxy's own (correct,
    // separate) rules further down. Fixed by anchoring the exclusion at the START of the whole
    // string via `^(?!.*...)` so it scans everywhere, not just after the "vaginal" match point.
    matches:
      /^(?!.*\b(?:cream|ring|imvexxy|estring|femring)\b).*estradiol vaginal\b|estradiol \(vaginal\)|vagifem|yuvafem/i,
    goodRxSlug: 'vagifem',
    costPlusPath: 'estradiol-10mcg-vaginaltablet8pack',
    goodRxPrice: { price: 90.88, quantity: '24 inserts, 10mcg' },
    costPlusPrice: { price: 87.42, quantity: '30 count, 10mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol vaginal cream|estrace cream/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-0_01-tubeofcream42_5g',
    costPlusPrice: { price: 14.19, quantity: '42.5g tube, 0.01%' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    // Fixed 2026-07-16: the old `estradiol.*(gel|divigel|...)` required the literal word
    // "estradiol" to appear before the brand name, so a bare "DIVIGEL"/"ESTROGEL"/"ELESTRIN"
    // mention (common in alternatives lists that don't repeat the generic name) fell through.
    // "\bgel\b" (word boundary) added the same day after UI verification caught a real
    // mispricing: "Angeliq" contains the literal substring "gel" (an-GEL-iq), so an alternative
    // combining "estradiol" and "Angeliq" in one string (e.g. "estradiol / drospirenone (generic
    // of Angeliq)") wrongly matched this rule and displayed the Divigel gel price instead of
    // Angeliq's real (not-carried) status.
    matches: /(estradiol.*\bgel\b)|divigel|estrogel|elestrin/i,
    goodRxSlug: 'divigel',
    goodRxParams: 'label_override=estradiol&form=carton&dosage=30-packets-of-1mg-gel&quantity=1',
    costPlusPath: 'estradiol-1mg-g-gel-packet-divigel',
    goodRxPrice: { price: 42.11, quantity: '30 packets, 1mg gel' },
    costPlusPrice: { price: 26.85, quantity: '30 packets, 1mg/gm' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /estradiol.*twice.weekly|dotti|lyllana|vivelle|minivelle|alora/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-(twice-weekly)-0_05-mg_24hr-patch-8-lyllana',
    goodRxPrice: { price: 54.82, quantity: '8 twice-weekly patches, 0.05mg/day' },
    costPlusPrice: { price: 47.83, quantity: '8 patches, 0.05mg/24hr' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol.*(weekly|patch|transdermal)|climara|menostar/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-0_05mg-carton-of-weekly-patches-4-climara',
    pricesCapturedAt: '2026-06-30',
  },
  {
    // "estradiol.*mg.*tablet" added 2026-08-05 -- CA's "estradiol 0.5 mg / 2 mg / 10 mcg tablets"
    // phrasing lacks the word "oral" but is clearly an oral tablet strength listing (0.5mg/2mg are
    // oral doses; 10mcg is likely a co-listed vaginal strength, but the dominant, representative
    // form here is oral). Safe this late in the rule order -- every vaginal/patch/gel/transdermal/
    // combo rule above already claims anything route-specific first.
    matches: /estradiol oral|estrace|^estradiol$|estradiol.*\bmg\b.*tablet/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-1mg-tablet',
    goodRxPrice: { price: 34.18, quantity: '90 tablets, 1mg' },
    costPlusPrice: { price: 6.77, quantity: '30 tablets, 1mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /medroxyprogesterone|provera/i,
    goodRxSlug: 'medroxyprogesterone',
    costPlusPath: 'medroxyprogesteroneacetate-10mg-tablet',
    goodRxPrice: { price: 29.39, quantity: '10 tablets, 10mg' },
    costPlusPrice: { price: 7.64, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-06-30',
  },
  // ---- Remaining menopause-HT alternatives (added 2026-07-16) ----
  // Same user UAT sweep as the blocks above. Cost Plus prices are real, captured 2026-07-16;
  // GoodRx omitted (pending -- see the NSAID block's note on the session-wide bot-check). Most of
  // the menopause-HT long tail (Femring, Bijuva, Crinone, Depo-Estradiol/estradiol cypionate,
  // Osphena, Endometrin, injectable estradiol valerate, plain vaginal progesterone insert) is
  // confirmed genuinely not carried by Cost Plus -- searched each by name, only unrelated fuzzy
  // matches or zero results came back. Left without a rule at all rather than a no-price rule,
  // consistent with how those forms were already deliberately excluded from the progesterone
  // rule above.
  {
    matches: /prempro/i,
    goodRxSlug: 'prempro',
    costPlusPath: 'prempro-0_3-1_5mg-28-tablets',
    costPlusPrice: { price: 224.26, quantity: '28 tablets, 0.3/1.5mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /premphase/i,
    goodRxSlug: 'premphase',
    costPlusPath: 'premphase-0_625-5mg-28-tablets',
    costPlusPrice: { price: 212.89, quantity: '28 tablets, 0.625/5mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /duavee/i,
    goodRxSlug: 'duavee',
    costPlusPath: 'duavee-0_45-20mg-30-tablets',
    costPlusPrice: { price: 184.62, quantity: '30 tablets, 0.45/20mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /megestrol/i,
    goodRxSlug: 'megestrol',
    costPlusPath: 'megestrol-acetate-20mg-tablet-megace',
    costPlusPrice: { price: 9.21, quantity: '20mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  // Confirmed not carried by Cost Plus (searched each by name 2026-07-16 -- only unrelated fuzzy
  // matches or zero results). GoodRx-slug-only for now so these at least link to the right vendor
  // page instead of falling to the generic fallback-slug guesser; GoodRx price pending (see the
  // NSAID block's note on the session-wide bot-check).
  {
    matches: /evamist/i,
    goodRxSlug: 'evamist',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /depo-estradiol|estradiol cypionate/i,
    goodRxSlug: 'depo-estradiol',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /crinone/i,
    goodRxSlug: 'crinone',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /femring/i,
    goodRxSlug: 'femring',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /endometrin/i,
    goodRxSlug: 'endometrin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Bare "progesterone" + intramuscular/injection/oil phrasing -- the injectable oil form,
    // distinct from the oral capsule and vaginal forms already priced/excluded above.
    matches: /progesterone.*(intramuscular|injection|\boil\b)/i,
    goodRxSlug: 'progesterone',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Bare "progesterone" + vaginal suppository/insert phrasing not already caught by the
    // Crinone/Endometrin brand rules above.
    matches: /progesterone.*(suppositor|vaginal insert|insert)/i,
    goodRxSlug: 'progesterone',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /intrarosa|prasterone/i,
    goodRxSlug: 'intrarosa',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /osphena|ospemifene/i,
    goodRxSlug: 'osphena',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /menest|estratest|\beemt\b|covaryx|esterified estrogens|estrogens-methyltestosterone/i,
    goodRxSlug: 'menest',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /angeliq|drospirenone/i,
    goodRxSlug: 'angeliq',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /bijuva/i,
    goodRxSlug: 'bijuva',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /prefest|norgestimate/i,
    goodRxSlug: 'prefest',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /estring/i,
    goodRxSlug: 'estring',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /estradiol valerate/i,
    goodRxSlug: 'estradiol-valerate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // "\bogen\b" (word boundary), not bare "ogen" -- the bare form matched the substring "ogen"
    // embedded inside "estrogen"/"estrogens" everywhere (an Angeliq/"gel"-class bug caught by a
    // full-formulary embedded-substring audit), silently shadowing the correctly-priced
    // Prempro/Premphase/Duavee/Premarin rules for any string mentioning "estrogens" that wasn't
    // already caught by a more specific rule earlier in the array.
    matches: /estropipate|\bogen\b/i,
    goodRxSlug: 'estropipate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Bare "progesterone" (the progestogen-cell inn) means ORAL micronized progesterone here.
    // Broadened 2026-07-09 to catch the bare inn, then narrowed same-day (code review) to exclude
    // non-oral forms (Crinone gel, vaginal suppository, Endometrin insert, injection oil) and combos
    // (Bijuva estradiol/progesterone) that would otherwise be mispriced as the 100mg oral capsule.
    // medroxyprogesterone has its own rule earlier, so first-match-wins keeps it unaffected.
    matches: /^(?!.*(vaginal|suppositor|\bgel\b|\binsert\b|crinone|endometrin|prochieve|intramuscular|injection|\boil\b|estradiol|bijuva)).*(progesterone|prometrium)/i,
    goodRxSlug: 'progesterone',
    costPlusPath: 'progesterone-100mg-capsule',
    goodRxPrice: { price: 31.54, quantity: '30 capsules, 100mg' },
    costPlusPrice: { price: 9.45, quantity: '30 capsules, 100mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    // "norethindrone.*5\s?mg" added 2026-07-16 -- a formulary source can name this drug
    // "norethindrone 5 mg tablet" without the word "acetate" even though 5mg is specifically the
    // acetate-salt strength (the plain/non-acetate form is 0.35mg, Ortho Micronor, a different
    // contraceptive-dose product). "norethindrone tablet \(generic\)" added 2026-08-05 -- PA
    // Medicaid's PDL lists a bare "Norethindrone Tablet" alongside "Gallifrey Tablet (norethindrone
    // acetate, brand)" in its PROGESTATIONAL AGENTS section (no strength stated); this app has no
    // contraception class, so every real occurrence of standalone norethindrone here is the
    // endometrial-protection acetate-salt dose, not the 0.35mg contraceptive product -- if a future
    // source names the 0.35mg product this bare, re-narrow this alternation.
    matches: /norethindrone acetate|norethindrone.*5\s?mg|norethindrone tablet \(generic\)/i,
    goodRxSlug: 'norethindrone',
    costPlusPath: 'norethindroneacetate-5mg-tablet',
    goodRxPrice: { price: 33.50, quantity: '30 tablets, 5mg' },
    costPlusPrice: { price: 8.48, quantity: '30 tablets, 5mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /^(?!.*oral solution).*(?:lisinopril|zestril|prinivil)/i,
    goodRxSlug: 'lisinopril',
    goodRxParams: 'label_override=lisinopril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'lisinopril-10mg-tablet',
    goodRxPrice: { price: 14.56, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.39, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:benazepril|lotensin)/i,
    goodRxSlug: 'benazepril',
    goodRxParams: 'label_override=benazepril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'benazeprilhcl-10mg-tablet',
    goodRxPrice: { price: 30.00, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.79, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:enalapril|vasotec)/i,
    goodRxSlug: 'enalapril',
    goodRxParams: 'label_override=enalapril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'enalaprilmaleate-10mg-tablet',
    goodRxPrice: { price: 27.65, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.69, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:ramipril|altace)/i,
    goodRxSlug: 'ramipril',
    goodRxParams: 'label_override=ramipril&form=capsule&dosage=10mg&quantity=30',
    costPlusPath: 'ramipril-10mg-capsule',
    goodRxPrice: { price: 28.00, quantity: '30 capsules, 10mg' },
    costPlusPrice: { price: 6.04, quantity: '30 capsules, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  // ---- Remaining ACE inhibitors + ACE-adjacent alternatives (added 2026-07-16) ----
  // Same "user UAT sweep, alternatives list" pass as the NSAID block above -- captopril,
  // fosinopril, moexipril, perindopril, quinapril, trandolapril were flagged as a gap back on
  // 2026-07-06 (see the KNOWN_UNPRICED_GAP history comment) but never actually priced. Cost Plus
  // prices are real, captured 2026-07-16; GoodRx omitted (pending -- see the NSAID block's note on
  // the "Press & Hold" bot-check blocking this session, not a confirmed-unavailable case).
  {
    // Combo -- must precede the plain fosinopril rule below.
    matches: /fosinopril.*hydrochlorothiazide|fosinopril.*hctz|monopril hct/i,
    goodRxSlug: 'fosinopril-hydrochlorothiazide',
    costPlusPath: 'fosinopril-sodium-hctz-10-12_5mg-tablet-monopril-hct',
    costPlusPrice: { price: 9.83, quantity: '10-12.5mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /fosinopril/i,
    goodRxSlug: 'fosinopril',
    costPlusPath: 'fosinopril-sodium-10mg-tablet-monopril',
    costPlusPrice: { price: 8.66, quantity: '10mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /captopril|capoten/i,
    goodRxSlug: 'captopril',
    costPlusPath: 'captopril-100mg-tablet-capoten',
    costPlusPrice: { price: 9.55, quantity: '100mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /moexipril|univasc/i,
    goodRxSlug: 'moexipril',
    costPlusPath: 'moexipril-hcl-15mg-tablet-univasc',
    costPlusPrice: { price: 37.29, quantity: '15mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /perindopril|aceon/i,
    goodRxSlug: 'perindopril',
    costPlusPath: 'perindopril-erbumine-2mg-tablet-aceon',
    costPlusPrice: { price: 22.39, quantity: '2mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo (verapamil ER) -- must precede the plain trandolapril rule below.
    matches: /trandolapril.*verapamil|tarka/i,
    goodRxSlug: 'trandolapril-verapamil',
    costPlusPath: 'trandolapril-verapamil-hcl-er-1-240mg-tablet-extended-release-tarka',
    costPlusPrice: { price: 157.52, quantity: '1-240mg extended-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /trandolapril|mavik/i,
    goodRxSlug: 'trandolapril',
    costPlusPath: 'trandolapril-1mg-tablet-mavik',
    costPlusPrice: { price: 6.97, quantity: '1mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns only an unrelated fuzzy match); GoodRx pending.
    matches: /quinapril|accupril/i,
    goodRxSlug: 'quinapril',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // ARNI, not a true ACE inhibitor, but appears as a covered alternative in some ACE guides.
    matches: /sacubitril|entresto/i,
    goodRxSlug: 'sacubitril-valsartan',
    costPlusPath: 'sacubitril-valsartan-24-26mg-tablet',
    costPlusPrice: { price: 9.04, quantity: '24-26mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // No Cost Plus match: not carried (searched "mometasone", "mometasone formoterol" -- only
    // topical/nasal mometasone forms exist there, no inhaler).
    matches: /dulera|mometasone.*formoterol/i,
    goodRxSlug: 'dulera',
    goodRxPrice: { price: 199.0, quantity: '1 inhaler, 200mcg/5mcg, 120 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "umeclidinium" -- only the umeclidinium/vilanterol (Anoro)
    // combo is carried, not standalone umeclidinium (Incruse Ellipta).
    matches: /incruse|umeclidinium/i,
    goodRxSlug: 'incruse-ellipta',
    goodRxPrice: { price: 211.22, quantity: '1 inhaler, 62.5mcg, 30 blisters' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "revefenacin" -- no medications found.
    matches: /yupelri|revefenacin/i,
    goodRxSlug: 'yupelri',
    goodRxPrice: { price: 1654, quantity: '1 carton, 175mcg/3mL, 30 vials' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "aclidinium" -- no real aclidinium product (only an unrelated
    // umeclidinium/vilanterol fuzzy hit).
    matches: /tudorza/i,
    goodRxSlug: 'tudorza-pressair',
    goodRxPrice: { price: 322.15, quantity: '1 inhaler, 400mcg, 60 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "mometasone" -- only topical/nasal forms carried, not the
    // Twisthaler. Doesn't collide with the Dulera rule above (that one requires "...formoterol").
    matches: /asmanex|mometasone furoate/i,
    goodRxSlug: 'asmanex',
    goodRxPrice: { price: 143.06, quantity: '1 inhaler, 220mcg, 60 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "ciclesonide" -- no medications found.
    matches: /alvesco|ciclesonide/i,
    goodRxSlug: 'alvesco',
    goodRxPrice: { price: 176.38, quantity: '1 inhaler, 160mcg' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "beclomethasone" -- only unrelated topical steroid fuzzy hits.
    matches: /qvar|beclomethasone/i,
    goodRxSlug: 'qvar',
    goodRxPrice: { price: 324.95, quantity: '1 redihaler, 80mcg, 10.6g' },
    pricesCapturedAt: '2026-07-06',
  },

  // ---- Diabetes + NSAID preferred agents (added 2026-07-09) ----
  // Every diabetes (metformin/GLP-1/SGLT2/insulin) and NSAID preferred agent across all 5 states
  // shipped link-only (no captured price) -- the 177-cell preferred-agent gap the 2026-07-09
  // validation run surfaced. Prices read off a real browser session (both vendors bot-block plain
  // fetch), ZIP 20009, on the capture date. GoodRx figure is the "Standard GoodRx price" unless a
  // manufacturer cash program is what the page surfaces (Jardiance/Lantus/Ozempic), matching the
  // existing inhaler rules' convention. Cost Plus omitted where the catalog genuinely doesn't carry
  // the drug (brand GLP-1s, brand SGLT2s, all insulins, OTC-strength ibuprofen) -- confirmed by
  // search, a documented outcome, not a research gap.
  {
    // Standalone metformin only. The negative lookahead excludes multi-ingredient combos
    // (Synjardy/Xigduo/Trijardy/Janumet/glipizide-metformin/pioglitazone-metformin/...) so they are
    // NOT priced as cheap plain metformin -- those fall through to the SGLT2 rules below (a
    // reasonable proxy, the SGLT2 is the costly component) or, for DPP4/SU/TZD combos, to the
    // no-price fallback (their pre-2026-07-09 behavior). Without this, ~50 covered combo names
    // showed $29.63, badly understating $300-600 brand combos.
    // "glucophage" added 2026-07-16 as a bare-brand-name alternative -- the bare brand mention
    // (no "metformin" substring at all) fell through this rule entirely before.
    matches: /^(?!.*\b(?:dapagliflozin|empagliflozin|canagliflozin|ertugliflozin|sitagliptin|saxagliptin|linagliptin|alogliptin|glipizide|glyburide|glimepiride|pioglitazone|rosiglitazone|repaglinide|nateglinide|synjardy|xigduo|trijardy|glyxambi|janumet|jentadueto|kazano|oseni|metaglip|glucovance|actoplus|kombiglyze|prandimet|invokamet|segluromet|qternmet|steglujan|soliqua)\b).*\bmetformin\b|^glucophage/i,
    goodRxSlug: 'metformin',
    goodRxParams: 'label_override=metformin&form=tablet&dosage=500mg&quantity=60',
    costPlusPath: 'metformin-500mg-tablet',
    goodRxPrice: { price: 29.63, quantity: '60 tablets, 500mg' },
    costPlusPrice: { price: 5.31, quantity: '30 tablets, 500mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /naproxen|naprosyn|anaprox/i,
    goodRxSlug: 'naproxen',
    goodRxParams: 'label_override=naproxen&form=tablet&dosage=500mg&quantity=60',
    costPlusPath: 'naproxen-500mg-tablet',
    goodRxPrice: { price: 30.71, quantity: '60 tablets, 500mg' },
    costPlusPrice: { price: 6.38, quantity: '30 tablets, 500mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // No Cost Plus match: ibuprofen 600mg and 800mg both 404 -- Cost Plus doesn't carry the
    // OTC-adjacent Rx strengths. GoodRx-only by design. "\bibu\b" added 2026-07-16 to catch
    // formularies that abbreviate the generic-brand name as bare "IBU".
    matches: /ibuprofen|\bibu\b/i,
    goodRxSlug: 'ibuprofen',
    goodRxParams: 'label_override=ibuprofen&form=tablet&dosage=600mg&quantity=30',
    goodRxPrice: { price: 29.65, quantity: '30 tablets, 600mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /meloxicam|mobic/i,
    goodRxSlug: 'meloxicam',
    goodRxParams: 'label_override=meloxicam&form=tablet&dosage=15mg&quantity=30',
    costPlusPath: 'meloxicam-15mg-tablet',
    goodRxPrice: { price: 19.61, quantity: '30 tablets, 15mg' },
    costPlusPrice: { price: 5.38, quantity: '30 tablets, 15mg' },
    pricesCapturedAt: '2026-07-09',
  },
  // ---- Remaining oral NSAID alternatives (added 2026-07-16) ----
  // The 2026-07-16 UAT found ~19 real NSAID molecules (celecoxib + the "second-tier" oral NSAIDs)
  // with zero cash-link rule at all, referenced under ~200 different verbatim phrasings across the
  // 5 NSAID guides' alternatives lists (one per source PDF's own wording). Cost Plus prices below
  // are real, captured 2026-07-16 off a real browser session. GoodRx prices are OMITTED, not
  // confirmed-unavailable -- GoodRx's bot-check (a real "Press & Hold" CAPTCHA, not the usual
  // plain-fetch 403) blocked this session's attempts after one successful lookup (celecoxib:
  // $21.41, 30x200mg, standard price). Revisit to fill these in; do not treat the omission as
  // "Cost Plus only by design" the way the ibuprofen rule above is.
  {
    // Combo product -- must precede the plain diclofenac rule below (its name always contains
    // "diclofenac").
    matches: /diclofenac.*misoprostol|arthrotec/i,
    goodRxSlug: 'arthrotec',
    costPlusPath: 'diclofenac-misoprostol-50-0_2mg-tablet-delayed-release-arthrotec',
    costPlusPrice: { price: 16.83, quantity: '50-0.2mg tablets, delayed release' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Topical/gel forms (Voltaren Gel, Pennsaid) are a distinct product from the oral tablet --
    // must precede the plain diclofenac rule below.
    matches: /diclofenac.*(gel|topical|patch|solution)|voltaren gel|pennsaid/i,
    goodRxSlug: 'diclofenac',
    costPlusPath: 'diclofenac-sodium-0_10-solution-dropper-5-voltaren',
    costPlusPrice: { price: 9.02, quantity: '5mL dropper, 0.10% solution' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Diclofenac potassium (immediate-release, Cataflam/Zipsor/Lofena family) -- must precede the
    // plain diclofenac rule below since "potassium" is more specific.
    matches: /diclofenac potassium/i,
    goodRxSlug: 'diclofenac-potassium',
    costPlusPath: 'diclofenacpotassium-50mg-tablet',
    costPlusPrice: { price: 7.14, quantity: '30 tablets, 50mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Catch-all diclofenac (sodium DR/ER/unspecified salt) -- must stay after the three diclofenac
    // rules above so combo/topical/potassium forms don't fall through to this ER sodium price.
    // GoodRx price is the bare-slug default (75mg delayed-release, 60 tablets) -- a different
    // strength/form than the 100mg ER Cost Plus price, kept anyway per this file's existing
    // tolerance for representative same-molecule pricing across strengths.
    matches: /diclofenac/i,
    goodRxSlug: 'diclofenac-sodium',
    costPlusPath: 'diclofenacsodiumer-100mg-tablet',
    goodRxPrice: { price: 20.43, quantity: '60 tablets, 75mg delayed-release' },
    costPlusPrice: { price: 20.25, quantity: '100mg extended-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /celecoxib|celebrex/i,
    goodRxSlug: 'celecoxib',
    goodRxParams: 'label_override=celecoxib&form=capsule&dosage=200mg&quantity=30',
    costPlusPath: 'celecoxib-100mg-capsule',
    goodRxPrice: { price: 21.41, quantity: '30 capsules, 200mg' },
    costPlusPrice: { price: 5.83, quantity: '30 capsules, 100mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /etodolac|lodine/i,
    goodRxSlug: 'etodolac',
    costPlusPath: 'etodolac-200mg-capsule',
    costPlusPrice: { price: 10.14, quantity: '200mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /flurbiprofen|ansaid|lurbiro/i,
    goodRxSlug: 'flurbiprofen',
    costPlusPath: 'flurbiprofen-100mg-tablet-ansaid',
    costPlusPrice: { price: 14.80, quantity: '100mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Immediate-release only -- Cost Plus's indomethacin ER (75mg) is a separate, unpriced product.
    matches: /indomethacin|indocin/i,
    goodRxSlug: 'indomethacin',
    costPlusPath: 'indomethacin-25mg-capsule',
    costPlusPrice: { price: 7.79, quantity: '25mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Extended-release only -- must precede the plain ketoprofen rule below. Cost Plus doesn't
    // carry the immediate-release 50/75mg capsule at all (confirmed by search), only this ER form,
    // which is priced much higher -- do not let the bare "ketoprofen" rule below inherit this price.
    matches: /ketoprofen.*(er|extended)/i,
    goodRxSlug: 'ketoprofen',
    costPlusPath: 'ketoprofen-200-mg-capsule-extended-release-24-hour',
    costPlusPrice: { price: 170.98, quantity: '200mg extended-release capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Immediate-release: Cost Plus doesn't carry it (confirmed by search) -- GoodRx-link-only for
    // now (see the block comment above; this is a tool-outage gap, not a confirmed unavailability).
    matches: /ketoprofen/i,
    goodRxSlug: 'ketoprofen',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /ketorolac|toradol/i,
    goodRxSlug: 'ketorolac',
    costPlusPath: 'KetorolacTromethamine-10mg-Tablet',
    costPlusPrice: { price: 6.72, quantity: '10mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /nabumetone|relafen/i,
    goodRxSlug: 'nabumetone',
    costPlusPath: 'nabumetone-500mg-tablet',
    costPlusPrice: { price: 7.14, quantity: '500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /oxaprozin|daypro|coxanto/i,
    goodRxSlug: 'oxaprozin',
    costPlusPath: 'oxaprozin-600mg-tablet-daypro',
    costPlusPrice: { price: 12.07, quantity: '600mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /piroxicam|feldene/i,
    goodRxSlug: 'piroxicam',
    costPlusPath: 'piroxicam-10mg-capsule-feldene',
    costPlusPrice: { price: 7.76, quantity: '10mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /sulindac|clinoril/i,
    goodRxSlug: 'sulindac',
    costPlusPath: 'sulindac-150mg-tablet-clinoril',
    costPlusPrice: { price: 9.97, quantity: '150mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /mefenamic acid|ponstel/i,
    goodRxSlug: 'mefenamic-acid',
    costPlusPath: 'mefenamic-acid-250mg-capsule-ponstel',
    costPlusPrice: { price: 21.56, quantity: '250mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /diflunisal|dolobid/i,
    goodRxSlug: 'diflunisal',
    costPlusPath: 'diflunisal-500mg-tablet-dolobid',
    costPlusPrice: { price: 27.94, quantity: '500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /tolmetin|tolectin/i,
    goodRxSlug: 'tolmetin',
    costPlusPath: 'tolmetin-sodium-400mg-capsule-tolectin-ds',
    costPlusPrice: { price: 114.19, quantity: '400mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (confirmed by search -- returns only an unrelated fuzzy match).
    // GoodRx-link-only for now; see the block comment above.
    matches: /meclofenamate|meclomen/i,
    goodRxSlug: 'meclofenamate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (confirmed by search -- returns only an unrelated fuzzy match).
    // GoodRx-link-only for now; see the block comment above.
    matches: /salsalate/i,
    goodRxSlug: 'salsalate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /\baspirin\b/i,
    goodRxSlug: 'aspirin',
    costPlusPath: 'aspirin-low-dose-81mg-tablet-delayed-release-aspirin-low-dose',
    costPlusPrice: { price: 5.21, quantity: '81mg delayed-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo rules must sit ABOVE the single-agent dapagliflozin/empagliflozin rules below --
    // "XIGDUO XR (dapagliflozin-metformin)" also matches /dapagliflozin|farxiga/i, so the single-
    // agent rule would otherwise shadow this one (first match wins; see the metformin negative-
    // lookahead rule above for the same class of bug this ordering avoids).
    // Dapagliflozin-metformin combo (Xigduo XR). Synjardy/Synjardy XR (empagliflozin-metformin),
    // Trijardy XR (empagliflozin-linagliptin-metformin), and Glyxambi (empagliflozin-linagliptin)
    // are not carried -- no generic empagliflozin exists yet (matches the existing brand-only
    // Jardiance rule), so none of its combos are genericized either. GoodRx pending for those.
    matches: /xigduo/i,
    goodRxSlug: 'xigduo-xr',
    costPlusPath: 'dapagliflozin-metformin-hcl-er-5-500mg-extended-release-tablet',
    costPlusPrice: { price: 19.77, quantity: '5-500mg extended-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /synjardy|trijardy|glyxambi/i,
    goodRxSlug: 'synjardy',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Cost Plus slug carries the salt + brand suffix (dapagliflozin-propanediol-...-farxiga), not
    // the plain generic-name pattern -- see CLAUDE.md's Cost Plus slug scar tissue.
    matches: /dapagliflozin|farxiga/i,
    goodRxSlug: 'dapagliflozin',
    goodRxParams: 'label_override=dapagliflozin&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'dapagliflozin-propanediol-10mg-tablet-farxiga',
    goodRxPrice: { price: 20.15, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 8.35, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Brand only (no generic empagliflozin in the US at capture time); Cost Plus doesn't carry it.
    // GoodRx surfaces the manufacturer cash price ($249) vs. $759.99 retail.
    matches: /empagliflozin|jardiance/i,
    goodRxSlug: 'jardiance',
    goodRxParams: 'label_override=jardiance&form=tablet&dosage=10mg&quantity=30',
    goodRxPrice: { price: 249.0, quantity: '30 tablets, 10mg (manufacturer cash price)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Covers brand Lantus, biosimilar/interchangeable glargine (Basaglar, Semglee, glargine-yfgn,
    // "GLARGIN YFGN") and Toujeo (glargine U-300, same molecule + $35 program). Cost Plus doesn't
    // carry insulins. $35 is the Sanofi Insulins $35/30-day cap surfaced via GoodRx, which the
    // biosimilars match or beat. Negative lookahead excludes the Soliqua glargine-lixisenatide
    // fixed-dose combo (a GLP-1/insulin combo ~$600+, a different product) per code review.
    matches: /^(?!.*(lixisenatide|soliqua)).*(insulin glargine|glargin|lantus|basaglar|semglee|toujeo)/i,
    goodRxSlug: 'lantus',
    goodRxPrice: { price: 35.0, quantity: '30-day supply, 100 units/mL (Sanofi $35 program / GoodRx)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /insulin lispro|humalog|lispro|lyumjev/i,
    goodRxSlug: 'humalog',
    goodRxPrice: { price: 51.24, quantity: '1 vial, 10mL, 100 units/mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /insulin degludec|degludec|tresiba/i,
    goodRxSlug: 'tresiba',
    goodRxPrice: { price: 141.54, quantity: '1 vial, 10mL, 100 units/mL' },
    pricesCapturedAt: '2026-07-09',
  },
  // Cost Plus doesn't carry any brand insulin (confirmed by direct search 2026-07-16 for insulin
  // aspart and Humulin specifically; the finding matches this file's existing "Cost Plus doesn't
  // carry insulins" note on the Lantus/Humalog/Tresiba rules above, so the remaining brand
  // families below aren't re-verified individually). GoodRx pending for all -- see the NSAID
  // block's note on the session-wide bot-check.
  {
    matches: /insulin aspart|novolog|novorapid|merilog/i,
    goodRxSlug: 'novolog',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /humulin/i,
    goodRxSlug: 'humulin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /novolin/i,
    goodRxSlug: 'novolin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /fiasp/i,
    goodRxSlug: 'fiasp',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /insulin detemir|levemir|detemir/i,
    goodRxSlug: 'levemir',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /soliqua|lixisenatide/i,
    goodRxSlug: 'soliqua',
    pricesCapturedAt: '2026-07-16',
  },
  // ---- Remaining diabetes alternatives (added 2026-07-16) ----
  // Same user UAT sweep as the blocks above. Cost Plus prices are real, captured 2026-07-16;
  // GoodRx omitted (pending -- see the NSAID block's note on the session-wide bot-check).
  // Confirmed by search: Cost Plus does not carry ANY brand insulin (matches the existing
  // "Cost Plus doesn't carry insulins" note on the Lantus/Humalog/Tresiba rules above) --
  // NovoLog/insulin aspart, the Humulin family, the Novolin family, Fiasp, Levemir, Lyumjev,
  // Soliqua, and Merilog all confirmed not carried by direct search. Left without a rule at all
  // (GoodRx-pending) rather than a no-price rule, matching the existing insulin rules' convention.
  {
    // Cost Plus doesn't carry brand GLP-1/GIP agents (matches the existing Ozempic/Trulicity
    // pattern above).
    matches: /tirzepatide|mounjaro|zepbound/i,
    goodRxSlug: 'mounjaro',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /exenatide|byetta|bydureon/i,
    goodRxSlug: 'exenatide',
    costPlusPath: 'exenatide-5mcg_0_02ml-solution-pen-injector-1_2',
    costPlusPrice: { price: 625.65, quantity: '1.2mL pen-injector, 5mcg/0.02mL' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Cost Plus doesn't carry canagliflozin (search returns only an unrelated fuzzy match to
    // dapagliflozin/Farxiga); GoodRx pending.
    matches: /canagliflozin|invokana/i,
    goodRxSlug: 'canagliflozin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo -- must precede the bare glipizide rule below.
    matches: /glipizide.*metformin|metaglip/i,
    goodRxSlug: 'glipizide-metformin',
    costPlusPath: 'glipizide-metformin-hcl-2_5-250mg-tablet-metaglip',
    costPlusPrice: { price: 9.28, quantity: '2.5-250mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /glipizide.*(xl|extended.release)|glucotrol xl/i,
    goodRxSlug: 'glipizide-er',
    costPlusPath: 'glipizide-extended-release-10mg-tablet',
    costPlusPrice: { price: 7.35, quantity: '10mg extended-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /glipizide|glucotrol/i,
    goodRxSlug: 'glipizide',
    costPlusPath: 'glipizide-10mg-tablet',
    costPlusPrice: { price: 5.79, quantity: '10mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo -- must precede the bare glyburide rule below.
    matches: /glyburide.*metformin|glucovance/i,
    goodRxSlug: 'glyburide-metformin',
    costPlusPath: 'glyburide-metformin-5mg-500mg-tablet',
    costPlusPrice: { price: 11.00, quantity: '5-500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /glyburide.*micronized|glynase/i,
    goodRxSlug: 'glyburide-micronized',
    costPlusPath: 'glyburide-micronized-3mg-tablet-glynase',
    costPlusPrice: { price: 7.62, quantity: '3mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /glyburide/i,
    goodRxSlug: 'glyburide',
    costPlusPath: 'glyburide-1_25mg-tablet',
    costPlusPrice: { price: 5.79, quantity: '1.25mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /glimepiride|amaryl/i,
    goodRxSlug: 'glimepiride',
    costPlusPath: 'glimepiride-1mg-tablet',
    costPlusPrice: { price: 5.34, quantity: '1mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo (glimepiride) -- must precede the pioglitazone-metformin and bare pioglitazone rules
    // below.
    matches: /pioglitazone.*glimepiride|duetact/i,
    goodRxSlug: 'pioglitazone-glimepiride',
    costPlusPath: 'pioglitazone-hcl-glimepiride-30-2mg-tablet-duetact',
    costPlusPrice: { price: 294.77, quantity: '30-2mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo (metformin) -- must precede the bare pioglitazone rule below.
    matches: /pioglitazone.*metformin|actoplus/i,
    goodRxSlug: 'pioglitazone-metformin',
    costPlusPath: 'pioglitazone-metformin-15mg-500mg-tablet',
    costPlusPrice: { price: 7.69, quantity: '15-500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /pioglitazone|actos/i,
    goodRxSlug: 'pioglitazone',
    costPlusPath: 'pioglitazone-15mg-tablet',
    costPlusPrice: { price: 5.97, quantity: '15mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Combo -- must precede a bare sitagliptin rule if one is ever added.
    matches: /sitagliptin.*metformin|janumet/i,
    goodRxSlug: 'sitagliptin-metformin',
    costPlusPath: 'sitagliptin-phosphate-metformin-hcl-50-500mg-tablet',
    costPlusPrice: { price: 73.66, quantity: '50-500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /sitagliptin|januvia/i,
    goodRxSlug: 'sitagliptin',
    costPlusPath: 'sitagliptin-phosphate-25mg-tablet',
    costPlusPrice: { price: 64.68, quantity: '25mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns zero/unrelated results); GoodRx pending.
    matches: /alogliptin/i,
    goodRxSlug: 'alogliptin-metformin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (search returns only unrelated sitagliptin fuzzy matches); GoodRx
    // pending.
    matches: /saxagliptin/i,
    goodRxSlug: 'saxagliptin-metformin',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Brand only; Cost Plus doesn't carry it. Standard GoodRx price, 1-carton (1-month) supply.
    matches: /dulaglutide|trulicity/i,
    goodRxSlug: 'trulicity',
    goodRxPrice: { price: 1052, quantity: '1 carton (4 pens), 0.75mg/0.5mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /liraglutide|victoza/i,
    goodRxSlug: 'victoza',
    goodRxPrice: { price: 154.2, quantity: '1 carton (3 pens), 18mg/3mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Oral semaglutide -- MUST precede the injectable Ozempic rule below so oral cells don't route
    // to the pen. Cost Plus doesn't carry it.
    matches: /rybelsus|semaglutide.*oral|oral.*semaglutide/i,
    goodRxSlug: 'rybelsus',
    goodRxPrice: { price: 1065, quantity: '30 tablets, 3mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Injectable semaglutide. GoodRx migrated its Ozempic page to the new oral tablet and gates the
    // pen behind a form switch; $199 is the NovoCare 1-month pen cash price the page surfaces (vs.
    // ~$950 standard). Cost Plus doesn't carry it.
    matches: /semaglutide|ozempic/i,
    goodRxSlug: 'ozempic',
    goodRxPrice: { price: 199, quantity: '1 pen, 1-month supply (NovoCare cash price via GoodRx)' },
    pricesCapturedAt: '2026-07-09',
  },

  // ---- Non-diabetes/NSAID straggler preferred agents (added 2026-07-09) ----
  // The last 7 preferred-agent cells with no captured price after the diabetes/NSAID sweep above:
  // vaginal estradiol (4), ipratropium (2), oral conjugated estrogens (1). Same real browser
  // session, same capture date.
  {
    // Vaginal estradiol insert/tablet/cream (generic Vagifem/Yuvafem/Estrace Vaginal). Placed after
    // the transdermal/patch estradiol rules above so it only catches the vaginal phrasing.
    matches: /estradiol vaginal|vaginal.*estradiol|vagifem|yuvafem|imvexxy/i,
    goodRxSlug: 'estradiol',
    goodRxParams: 'form=insert&label_override=estradiol',
    goodRxPrice: { price: 159.35, quantity: '24 inserts, 10mcg (generic Vagifem/Yuvafem)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Both ipratropium cells resolve by the bare name "ipratropium bromide" (coveredDrugNames keys
    // off inn/brand, not strength) so one rule serves both. Priced as the generic nebulizer solution
    // (0.02%, 25 vials, $33.96) -- the common multisource form. The brand Atrovent HFA aerosol
    // (17mcg inhaler) runs ~$233.92 standard; the name-based rule can't distinguish the two forms
    // (the logged "strength/form as a first-class field" limitation).
    matches: /ipratropium|atrovent/i,
    goodRxSlug: 'ipratropium',
    goodRxParams: 'form=vial&dosage=0.02%25&label_override=ipratropium-bromide',
    goodRxPrice: { price: 33.96, quantity: '25 vials, 0.02% (2.5mL nebulizer solution)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Brand only (no generic conjugated estrogens). Word order fixed 2026-07-16: some formulary
    // sources write "estrogens conjugated" (reversed), which the original "conjugated estrogen"
    // literal-order match silently missed. Cost Plus DOES carry Premarin (corrects the prior
    // "doesn't carry it" note -- that was true for the 0.625mg strength cited by the old GoodRx
    // rule, but the 0.3mg product is real and priced).
    matches: /conjugated estrogen|estrogens? conjugated|premarin/i,
    goodRxSlug: 'premarin',
    goodRxParams: 'form=tablet&dosage=0.625mg&quantity=30&label_override=premarin',
    costPlusPath: 'premarin-0_3mg-tablet',
    goodRxPrice: { price: 99.0, quantity: '30 tablets, 0.625mg (GoodRx coupon)' },
    costPlusPrice: { price: 192.85, quantity: '0.3mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },

  // ---- SSRIs (added 2026-07-29) ----
  // Closes the KNOWN_UNPRICED_GAP opened 2026-07-18 when ny-ssris shipped with zero cash-link
  // rules (headless run, GoodRx bot-blocked). A real browser session was available this run;
  // captured GoodRx + Cost Plus for all 6 SSRI molecules, which prices every ssri-oral cell
  // across all 7 shipped SSRI guides (NY/MA/MD/VA/IL/AL/PA) at once -- one drug-name universe
  // shared by every state's guide. Escitalopram's word boundary correctly excludes it from the
  // citalopram rule below (no \b between "es" and "citalopram").
  {
    matches: /\bsertraline\b|\bzoloft\b/i,
    goodRxSlug: 'sertraline',
    costPlusPath: 'sertraline-50mg-tablet',
    goodRxPrice: { price: 22.45, quantity: '30 tablets, 50mg' },
    costPlusPrice: { price: 5.69, quantity: '30 tablets, 50mg' },
    pricesCapturedAt: '2026-07-29',
  },
  {
    matches: /\bcitalopram\b|\bcelexa\b/i,
    goodRxSlug: 'citalopram',
    costPlusPath: 'CitalopramHydrobromide-10mg-Tablet',
    goodRxPrice: { price: 29.23, quantity: '30 tablets, 20mg' },
    costPlusPrice: { price: 5.45, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-29',
  },
  {
    matches: /\bescitalopram\b|\blexapro\b/i,
    goodRxSlug: 'escitalopram',
    costPlusPath: 'EscitalopramOxalate-10mg-Tablet',
    goodRxPrice: { price: 29.45, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 6.24, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-29',
  },
  {
    matches: /\bfluoxetine\b|\bprozac\b/i,
    goodRxSlug: 'fluoxetine',
    costPlusPath: 'fluoxetine-10mg-capsule',
    goodRxPrice: { price: 26.43, quantity: '30 capsules, 20mg' },
    costPlusPrice: { price: 5.38, quantity: '30 capsules, 10mg' },
    pricesCapturedAt: '2026-07-29',
  },
  {
    // GoodRx served a "Press & Hold" bot-check for this molecule this session (same intermittent
    // block documented elsewhere in this file) -- Cost Plus only, not a research gap.
    matches: /\bparoxetine\b|\bpaxil\b/i,
    goodRxSlug: 'paroxetine',
    costPlusPath: 'paroxetine-10mg-tablet',
    costPlusPrice: { price: 5.66, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-29',
  },
  {
    // Same GoodRx bot-check as paroxetine above. Cost Plus's lowest listed strength for this
    // molecule is 100mg (25mg/50mg also sold, not captured this pass).
    matches: /\bfluvoxamine\b|\bluvox\b/i,
    goodRxSlug: 'fluvoxamine',
    costPlusPath: 'fluvoxaminemaleate-100mg-tablet',
    costPlusPrice: { price: 8.55, quantity: '30 tablets, 100mg' },
    pricesCapturedAt: '2026-07-29',
  },

  // ---- Osteoporosis oral agents (added 2026-07-30) ----
  // Prices the oral-bisphosphonate and serm preferred-agent cells across all 5 osteoporosis guides
  // (NY/MA/MD/VA/IL). The other 3 classes' preferred agents (zoledronic acid/Reclast infusion,
  // denosumab/Prolia, teriparatide/Forteo, abaloparatide/Tymlos) are specialty injectables/infusions
  // with no Cost Plus listing (checked -- Cost Plus's bone-health category carries only alendronate
  // and raloxifene) and GoodRx bot-blocked this session (global "Access to this page has been
  // denied" after ~2 successful lookups, not a per-page block) before they could be captured --
  // logged to backlog.md as the remaining osteoporosis cash-price gap for a future browser session.
  {
    matches: /\balendronate\b|\bfosamax\b/i,
    goodRxSlug: 'alendronate',
    goodRxParams: 'dosage=70mg&form=tablet&quantity=4&label_override=alendronate',
    costPlusPath: 'alendronate-10mg-tablet',
    goodRxPrice: { price: 29.3, quantity: '4 tablets, 70mg (once-weekly dosing)' },
    costPlusPrice: { price: 7.38, quantity: '30 tablets, 10mg (daily-dosing strength)' },
    pricesCapturedAt: '2026-07-30',
  },
  {
    matches: /\braloxifene\b|\bevista\b/i,
    goodRxSlug: 'raloxifene',
    goodRxParams: 'dosage=60mg&form=tablet&quantity=30&label_override=raloxifene',
    costPlusPath: 'raloxifenehcl-60mg-tablet',
    goodRxPrice: { price: 31.86, quantity: '30 tablets, 60mg' },
    costPlusPrice: { price: 8.42, quantity: '30 tablets, 60mg' },
    pricesCapturedAt: '2026-07-30',
  },
  {
    // Prolia + every denosumab biosimilar (Jubbonti/Wyost/Stoboclo/Osenvelt/Conexxence/Bomyntra/
    // Bildyos/Bosaya/Enoby/Ospomyv/Osvyrti/Xbryk/Jubereq/Ponlimsi/Xtrenbo/Bilprevda) share one
    // 60 mg/mL osteoporosis-strength price -- the bare `goodrx.com/prolia` slug landed on the exact
    // right product (1 syringe, 60 mg/mL) by default, no params needed. Excludes Xgeva: same
    // molecule but a different 120 mg/1.7 mL oncology-dosing product at a different price point, not
    // the osteoporosis rankl-inhibitor cell. No Cost Plus listing (checked its bone-health category
    // 2026-07-30 -- doesn't carry any of the 3 specialty injectables/infusions in this class).
    matches:
      /^(?!.*\bxgeva\b).*(?:\bdenosumab\b|\bprolia\b|\bjubbonti\b|\bwyost\b|\bstoboclo\b|\bosenvelt\b|\bconexxence\b|\bbomyntra\b|\bbildyos\b|\bbosaya\b|\benoby\b|\bospomyv\b|\bosvyrti\b|\bxbryk\b|\bjubereq\b|\bponlimsi\b|\bxtrenbo\b|\bbilprevda\b)/i,
    goodRxSlug: 'prolia',
    goodRxPrice: { price: 1832.87, quantity: '1 syringe, 60mg/mL (osteoporosis dose; standard GoodRx price)' },
    pricesCapturedAt: '2026-08-02',
  },
  {
    // Teriparatide/Forteo/Bonsity (anabolic) -- Cost Plus's catalog picked this molecule up
    // sometime between 2026-07-30 (confirmed absent) and 2026-08-04 (confirmed present), same
    // 560 mcg/2.24 mL pen strength every formulary cell in this class prescribes. Covers the
    // generic ("teriparatide"), originator brand (Forteo), and the Pfizer authorized-generic-style
    // brand (Bonsity) name variants seen across the shipped osteoporosis guides. GoodRx was
    // session-wide "Access to this page has been denied" blocked from the first lookup this
    // session (harder than 2026-08-02's 2-lookup grace period), so no GoodRx price this pass --
    // Cost-Plus-only, same pattern as the paroxetine/fluvoxamine SSRI rules. Abaloparatide/Tymlos
    // (a related but distinct anabolic) still has no Cost Plus listing -- checked separately.
    matches: /\bteriparatide\b|\bforteo\b|\bbonsity\b/i,
    goodRxSlug: 'teriparatide',
    costPlusPath: 'teriparatide-560-mcg_2_24ml-solution-pen-injector-2_24',
    costPlusPrice: { price: 775.15, quantity: '1 pen-injector, 560 mcg/2.24 mL' },
    pricesCapturedAt: '2026-08-04',
  },
  {
    // Atelvia/delayed-release risedronate -- a genuinely different product (35mg once-weekly
    // delayed-release tablet) with its own real Cost Plus price, captured the same session as the
    // bare risedronate rule below. Caught by Codex review 2026-08-05: the original bare
    // `\brisedronate\b` rule's own comment said Atelvia "should not be folded into" the 5mg-daily
    // rule, but the regex did exactly that -- every covered name mentioning "delayed-release" or
    // "Atelvia" also contains the word "risedronate" and matched the bare rule first, showing the
    // $31.54/30-tablet-5mg price for a 4-tablet/35mg-DR product. Placed before the bare rule so
    // Atelvia/DR names route here instead. Multi-strength alternatives that mention
    // "delayed-release" alongside other strengths (e.g. "risedronate sodium (35 mg weekly, 5 mg
    // daily, 150 mg monthly, delayed-release 35 mg)") are inherently ambiguous about which single
    // strength to represent -- treated as DR since that's the most specific term present.
    matches: /atelvia|delayed.release|\bdr\/ec\b|\btbec\b/i,
    goodRxSlug: 'atelvia',
    costPlusPath: 'risedronate-sodium-35mg-tablet-atelvia',
    costPlusPrice: { price: 101.53, quantity: '4 tablets, 35mg delayed-release (once-weekly dosing)' },
    pricesCapturedAt: '2026-08-05',
  },
  {
    // Risedronate/Actonel oral-bisphosphonate -- Cost Plus carries the daily-dose 5mg strength
    // (30 tablets) as the representative price, same convention as alendronate/raloxifene above.
    // GoodRx session-wide blocked ("Access to this page has been denied" from the first lookup),
    // Cost-Plus-only this pass. The Atelvia/delayed-release rule above claims that variant first.
    matches: /\brisedronate\b|\bactonel\b/i,
    goodRxSlug: 'risedronate',
    costPlusPath: 'risedronate-sodium-5mg-tablet-actonel',
    costPlusPrice: { price: 31.54, quantity: '30 tablets, 5mg (daily-dosing strength)' },
    pricesCapturedAt: '2026-08-05',
  },
  {
    // Ibandronate/Boniva oral-bisphosphonate -- Cost Plus's only listing is the once-monthly 150mg
    // dose-pack-of-3 (a 3-month supply, oral tablet). GoodRx session-wide blocked, Cost-Plus-only
    // this pass. Route-of-administration exclusion: several covered names explicitly describe IV/
    // injectable ibandronate ("ibandronate IV (injectable)", "Ibandronate Syringe, Ibandronate
    // Vial", "ibandronate sodium (oral and IV, generic Boniva)") -- Cost Plus does not carry that
    // formulation (confirmed 2026-08-05, only the oral dose-pack appears), so pricing those as the
    // cheap oral tablet would misrepresent a different, unpriced product. Excludes any name
    // mentioning iv/injection/injectable/syringe/vial; those fall through to the unpriced gap
    // instead. Same route-mismatch caution as the Reclast/Zometa and Respimat/HandiHaler traps
    // documented in CLAUDE.md.
    matches: /^(?!.*\b(?:iv|injection|injectable|syringe|vial)\b).*(?:\bibandronate\b|\bboniva\b)/i,
    goodRxSlug: 'ibandronate',
    costPlusPath: 'ibandronate-sodium-150mg-tablet-dose-pack-3-boniva',
    costPlusPrice: { price: 8.51, quantity: '1 dose pack of 3 tablets, 150mg (3-month supply)' },
    pricesCapturedAt: '2026-08-05',
  },
  {
    // Zoledronic acid/Reclast (iv-bisphosphonate) -- GoodRx access recovered this session after 7
    // consecutive sessions of a hard block. The bare `goodrx.com/zoledronic-acid` slug resolved to
    // the correct osteoporosis-strength product this time ("Zoledronic Acid 100mL of 5mg/100mL, 1
    // bottle of infusion") -- explicit params pin that exact strength/quantity down regardless, so
    // a future session's default doesn't drift back to the WRONG oncology-dose product (4mg/5mL
    // Zometa-equivalent) the way the bare slug did on 2026-08-02. Excludes any covered name that
    // explicitly states the 4mg oncology/Paget's/malignancy dose or names Zometa -- those are a
    // real, distinct, unpriced product (see the "Zoledronic acid 4 mg" MassHealth alternative,
    // billed as MB/hospital-administered for Paget's/malignancy, not this osteoporosis price). No
    // Cost Plus listing (checked its bone-health category repeatedly since 2026-07-30, unchanged).
    matches: /^(?!.*\b(?:zometa|4\s*mg|oncology|malignan)\b).*(?:\bzoledronic acid\b|\breclast\b)/i,
    goodRxSlug: 'zoledronic-acid',
    goodRxParams: 'dosage=5mg%2F100ml&form=solution&quantity=1&label_override=zoledronic-acid',
    goodRxPrice: { price: 81.49, quantity: '1 bottle, 5mg/100mL IV infusion (once-yearly osteoporosis dose)' },
    pricesCapturedAt: '2026-08-09',
  },
  {
    // Abaloparatide/Tymlos (anabolic) -- same GoodRx-access recovery as zoledronic acid above. The
    // bare `goodrx.com/abaloparatide` slug landed directly on the Tymlos page at its correct FDA-
    // labeled strength (80 mcg/dose pen, 1.56 mL), no wrong-product risk observed. No Cost Plus
    // listing (checked its bone-health category repeatedly since 2026-07-30, unchanged).
    matches: /\babaloparatide\b|\btymlos\b/i,
    goodRxSlug: 'abaloparatide',
    goodRxPrice: { price: 3030, quantity: '1 pen, 1.56mL of 80mcg/dose (standard GoodRx price)' },
    pricesCapturedAt: '2026-08-09',
  },
]
// Romosozumab/Evenity and pamidronate were checked this same session (2026-08-09) but deliberately
// left with NO cash-link rule: both GoodRx pages are tagged "Physician-administered" with no
// "Choose pharmacy"/retail price panel at all (unlike zoledronic acid above, which still gets a
// specialty-pharmacy dispensing price despite also being professionally administered) -- there is
// no real self-pay retail price to show for a true buy-and-bill-only infusion, so a fabricated
// number would misrepresent how these drugs are actually obtained. Etidronate disodium was not
// reached before GoodRx re-blocked ("Access to this page has been denied") partway through this
// session. See backlog.md for the current state of all three.

function fallbackSlug(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function cashLinkRule(name: string): CashLinkRule | undefined {
  return CASH_LINK_RULES.find((rule) => rule.matches.test(name))
}

export function goodRxUrl(name: string): string {
  const rule = cashLinkRule(name)
  const base = `https://www.goodrx.com/${rule?.goodRxSlug ?? fallbackSlug(name)}`
  return rule?.goodRxParams ? `${base}?${rule.goodRxParams}` : base
}

export function costPlusUrl(name: string): string | null {
  const path = cashLinkRule(name)?.costPlusPath
  return path ? `https://www.costplusdrugs.com/medications/${path}/` : null
}

/** Snapshot GoodRx price for this drug, or null if no exact strength/form match was captured. */
export function goodRxPrice(name: string): PricePoint | null {
  return cashLinkRule(name)?.goodRxPrice ?? null
}

/** Snapshot Cost Plus Drugs price for this drug, or null if unavailable/out of stock at capture time. */
export function costPlusPrice(name: string): PricePoint | null {
  return cashLinkRule(name)?.costPlusPrice ?? null
}

/** ISO date the prices above were captured, or null if this drug has no explicit cash-link rule. */
export function pricesCapturedAt(name: string): string | null {
  return cashLinkRule(name)?.pricesCapturedAt ?? null
}

/** Whether this drug resolves to an explicit rule, vs. the generic fallback-slug guesser. */
export function hasCashLinkRule(name: string): boolean {
  return cashLinkRule(name) !== undefined
}
