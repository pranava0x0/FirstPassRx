# Payer & Regulatory Landscape for PA Automation

Background research for FirstPassRx's prospective PA pre-drafting feature (pilot: Massachusetts,
fluticasone propionate HFA, payers = MassHealth / BCBS-MA / Point32Health / MGB Health Plan).

Researched 2026-08-24. Every claim carries its source URL and access date. Items that could not
be pinned to a source are marked UNVERIFIED.

Sections:

1. Federal regulation & standards (CMS-0057-F, Da Vinci CRD/DTR/PAS, NCPDP SCRIPT ePA)
2. State law: uniform PA forms & the 2024-2026 PA-reform wave
3. Payer-built PA automation (UHG/Optum, CVS-Aetna, Cigna/ESI, Humana, Elevance, AHIP pledge)
4. Massachusetts specifics (MassHealth pharmacy PA, commercial rules, the four pilot payers)
5. Implications for FirstPassRx

---

## 1. Federal regulation & standards

### 1.1 CMS-0057-F (Interoperability and Prior Authorization Final Rule, Jan 2024)

**Covered ("impacted") payers** — per CMS's own interoperability FAQ
(https://www.cms.gov/priorities/burden-reduction/overview/interoperability/frequently-asked-questions/general,
fetched 2026-08-24 via curl; page 403s plain WebFetch):

> "The 2024 CMS Interoperability and Prior Authorization final rule (CMS-0057-F) requires
> impacted payers (specifically, Medicare Advantage [MA] organizations, state Medicaid and
> Children's Health Insurance Program [CHIP] agencies, Medicaid managed care plans and CHIP
> managed care entities, and Qualified Health Plan [QHP] issuers on the Federally-facilitated
> Exchanges [FFEs]) to implement and maintain three new FHIR APIs..."

Commercial plans are explicitly OUT:

> "The only commercial payers affected by this final rule are Qualified Health Plans (QHPs)
> offered on the Federally-facilitated Exchanges (FFEs). ... The requirements do not apply to
> other health insurance issuers or group health plans." (Voluntary adoption encouraged.)

Note for the MA pilot: Massachusetts runs a **state-based exchange (the Health Connector), not
an FFE**, so even MA marketplace QHPs sold by BCBSMA/Point32Health/MGB Health Plan are outside
CMS-0057-F's mandate. Only MassHealth (state Medicaid agency + its Medicaid MCOs/ACOs) is an
impacted payer. [Exchange-type detail is well-established; the FFE-only scoping quote above is
the load-bearing citation.]

**DRUGS ARE EXCLUDED — the critical fact.** Exact FAQ language (same CMS FAQ page, 2026-08-24):

> "Why are drugs excluded from the prior authorization requirements in the 2024 CMS
> Interoperability and Prior Authorization final rule? CMS excluded drugs from both the Prior
> Authorization application programming interface (API) and the process requirements for prior
> authorizations in the 2024 CMS Interoperability and Prior Authorization final rule (CMS-0057-F)
> because the standards, processes, and decision timeframes for issuing prior authorizations for
> drugs differ from those that apply to medical items and services. However, payers are not
> prohibited from including drugs covered under a medical benefit in their Prior Authorization
> APIs, as the Coverage Requirements Discovery (CRD) Implementation Guide can accommodate
> information about certain medications. Proposals included in the new proposed rule (CMS-0062-P)
> would expand upon the 2024 CMS Interoperability and Prior Authorization final rule by extending
> previously finalized prior authorization requirements to also include drugs."

The Prior Authorization API itself is described as covering "specific medical items and services
(excluding drugs)"; the expanded Patient Access API likewise carries PA data "for items and
services (excluding drugs)". So the entire pharmacy benefit — and even medical-benefit drugs —
sits outside the rule's PA mandates. The exclusion covers drugs "of any type" (prescription,
self-administered, provider-administered, pharmacy-dispensed, hospital-administered) per CMS's
Prior Authorization API FAQ (https://www.cms.gov/initiatives/burden-reduction/overview/interoperability/frequently-asked-questions/prior-authorization-api,
surfaced in search 2026-08-24).

**Compliance deadlines** — per the official CMS-0057-F fact sheet
(https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f,
fetched 2026-08-24 via curl):

- **Jan 1, 2026 — operational/process provisions** ("generally beginning January 1, 2026"):
  - PA decision timeframes: 72 hours expedited / 7 calendar days standard — for impacted payers
    *excluding QHP issuers on the FFEs*.
  - Specific denial reason required on every PA denial "regardless of the method used to send the
    prior authorization request" (portal, fax, email, mail, phone). Fact sheet adds, verbatim:
    "As with all policies in this final rule, this provision does not apply to prior
    authorization decisions for drugs."
  - Public PA metrics posted annually on the payer's website; first report due March 31, 2026.
- **Jan 1, 2027 — API build requirements** ("generally beginning January 1, 2027"; exact dates
  vary by payer type): Patient Access API expansion (PA data, excluding drugs), Provider Access
  API, Payer-to-Payer API, and the Prior Authorization API itself.
- HHS announced **enforcement discretion on the HIPAA X12 278** PA transaction standard for
  covered entities that implement an all-FHIR Prior Authorization API per this rule.
- Adds an "Electronic Prior Authorization" measure to MIPS Promoting Interoperability and the
  Medicare Promoting Interoperability Program (attestation-style measure for clinicians/hospitals).

### 1.2 CMS-0062-P (2026 Interoperability Standards and Prior Authorization for Drugs — PROPOSED)

The drug gap is now the subject of its own proposed rule. Facts from the official fact sheet
(https://www.cms.gov/newsroom/fact-sheets/2026-cms-interoperability-standards-prior-authorization-drugs-proposed-rule,
dated Apr 10, 2026, fetched 2026-08-24 via curl) and the Federal Register listing
(https://www.federalregister.gov/documents/2026/04/14/2026-07205/..., published 2026-04-14,
surfaced in search 2026-08-24):

- Comment period closed **June 15, 2026**. **No final rule as of 2026-08-24** — CMS still lists
  it as a proposed rule.
- **Extends PA requirements to drugs.** Medical-benefit drugs: coverage + documentation
  requirements must be incorporated into the (CMS-0057-F) Prior Authorization APIs **beginning
  Oct 1, 2027** (proposed).
- **Pharmacy-benefit drugs:** state Medicaid and CHIP FFS programs, Medicaid managed care plans,
  CHIP managed care entities, and FFE QHP issuers would be required to support three **NCPDP
  standards — SCRIPT, Formulary & Benefit (F&B), and Real-Time Prescription Benefit (RTPB)** —
  beginning Oct 1, 2027, "which aligns with existing requirements for Medicare Part D sponsors."
- **Drug PA decision timeframes (proposed, from Oct 1, 2027):** Medicaid/CHIP programs — no later
  than 24 hours for covered outpatient drug PAs (aligning with the existing Medicaid covered-
  outpatient-drug rule) or 7 days std / 72 h expedited under the items-and-services track; FFE
  QHPs — 72 h standard / 24 h expedited for all drugs.
- Adds **FF-SHOP small-group QHP issuers** as impacted payers.
- **HIPAA-wide FHIR proposal (reaches ALL payers, including commercial):** HHS proposes adopting
  FHIR + named IGs as the HIPAA Administrative Simplification standard for the "referral
  certification and authorization" transaction (replacing X12 278) and Da Vinci **CDex** for PA
  attachments — applying to **all HIPAA covered entities that exchange PA electronically**, with
  compliance 24 months after the final rule's effective date (36 months for small health plans).
  Entities that don't do electronic PA are not required to adopt.
- Payers would have to report API endpoints + FHIR capability statements to CMS for central
  publication (60 days after effective date).
- Names the Da Vinci IG versions that would become required for the PA stack: CRD v2.0.1/v2.2.1,
  DTR v2.0.1/v2.2.0, PAS v2.0.1/v2.2.1 (older versions proposed to expire Jan 1, 2028), plus
  PDex, PDex US Drug Formulary, Plan-Net, CARIN Blue Button.

### 1.3 HL7 Da Vinci CRD / DTR / PAS (the FHIR "medical-benefit" ePA stack)

What they are (per the HL7 Da Vinci PAS IG homepage, https://hl7.org/fhir/us/davinci-pas/, and
CMS-0062-P fact sheet, both accessed 2026-08-24):

- **CRD (Coverage Requirements Discovery):** CDS-Hooks-based; fires inside the EHR when a
  provider orders something, and tells them whether the payer requires PA and what documentation
  applies.
- **DTR (Documentation Templates and Rules):** lets the EHR download the payer's "smart
  questionnaire" (FHIR Questionnaire + CQL rules) and pre-populate it from the chart — this is
  the payer-side analogue of what a PA-drafting feature does.
- **PAS (Prior Authorization Support):** packages the request and submits it to the payer
  (bridging to X12 278 where needed), returns approve/deny/pend + reasons. Current published
  version v2.1.0; v2.2.x in ballot (https://build.fhir.org/ig/HL7/davinci-pas/).

Adoption status 2026: mandated-in-effect for CMS impacted payers from **Jan 1, 2027** (CMS-0057-F
recommends these IGs; CMS-0062-P would make specific versions required from Oct 1, 2027).
Real-world use today is still early — payers are mid-build against the 2027 deadline; the X12 278
enforcement-discretion announcement exists precisely to let all-FHIR implementations go live.
**Scope caveat for FirstPassRx: CRD/DTR/PAS is the *medical-benefit* stack. Pharmacy-benefit drug
PA runs on NCPDP SCRIPT ePA instead (below), and remains outside every finalized federal API
mandate.**

### 1.4 NCPDP SCRIPT ePA (the pharmacy-benefit ePA standard)

Sources: IntuitionLabs explainer (https://intuitionlabs.ai/articles/ncpdp-script-epa-surescripts,
accessed 2026-08-24); CMS e-prescribing standards page + Part D ePA final rule (85 FR — "Secure
Electronic Prior Authorization for Medicare Part D," Federal Register doc 2020-28877, published
2020-12-31; page bot-blocks WebFetch, facts confirmed via search snippets 2026-08-24).

- **Mechanism — the question-set flow:** EHR flags PA at prescribing time (via eligibility/
  formulary data) → prescriber initiates **PAInitiationRequest** (XML: patient, insurance, NDC,
  dosing, diagnosis) → payer/PBM returns its **closed question set** for that drug (the payer's
  criteria rendered as structured questions) → prescriber answers in the EHR; answers return via
  **PARequest/PAResponse** → payer adjudicates (often auto-adjudicates) and returns
  approve/deny/pend. Companion transactions: PACancelRequest, PAAppealRequest, PANotification.
  The payer's question set — not a static form — is the unit of "what the payer wants to know"
  in this channel.
- **Versions:** SCRIPT v2017071 mandatory for Medicare Part D ePA since **Jan 1, 2022** (allowed
  from Jan 1, 2021). Transition period ends **Jan 1, 2028**, after which **v2023011** is the
  exclusive standard (per CMS e-prescribing standards page, cms.gov/medicare/regulations-guidance/
  electronic-prescribing/adopted-standard-and-transactions, search-confirmed 2026-08-24).
  CMS-0062-P would extend SCRIPT ePA (plus F&B and RTPB) to Medicaid/CHIP/FFE-QHP payers from
  Oct 1, 2027 (§1.2).
- **Who operates the rails:** Surescripts (CompletEPA) — the dominant e-prescribing network
  (~2.3M clinicians, nearly all US pharmacies + major PBMs); CoverMyMeds (McKesson) — 500+ EHR
  integrations, ~900k providers, payers covering ~95% of prescription volume, and the biggest
  *portal* alternative when an EHR lacks embedded ePA; DrFirst rides CoverMyMeds infrastructure
  with fax fallback. (Figures per IntuitionLabs, accessed 2026-08-24 — treat exact numbers as
  vendor-reported.)
- **Reality check:** ~half of pharmacy PA volume was still phone/fax as of ~2020 survey data, and
  a 2022 AMA-style survey found 82% of providers still spend hours weekly on PA; ePA-equipped
  practices often handle *more* PAs, not less time. Fax remains a first-class fallback everywhere.

---

## 2. State law: uniform PA forms & the 2024-2026 reform wave

### 2.1 State-mandated standard/uniform PA forms for prescription drugs

States that require commercial insurers to use/accept a state-designated standard form for
medication PA (all sources accessed 2026-08-24):

| State | Instrument | Form | Notes |
|---|---|---|---|
| **MA** | M.G.L. c. 176O § 25; DOI Bulletin 2016-08 | "Massachusetts Standard Form for Medication Prior Authorization Requests" (v1.0, May 2016) | Deemed GRANTED if payer doesn't use/accept form or respond in 2 business days. Details §4.1. |
| **CA** | SB 866 (2011); Health & Safety Code / Ins. Code | **Form 61-211** "Prescription Drug Prior Authorization or Step Therapy Exception Request Form" (2 pages) | Mandatory since Oct 1, 2014 (SFMMS: http://www.sfmms.org/news-events/sfmms-blog/form-61211.aspx); updated version mandatory Jan 1, 2018 (https://www.cahealthwellness.com/newsroom/Reminder_New_PA_Form.html). Bill: https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201120120SB866 |
| **TX** | SB 644 (2013); TDI 28 TAC ch.19 subch. S, div. 3 | **NOFR002** "Texas Standard Prior Authorization Request Form for Prescription Drug Benefits" (NOFR001 = medical services) | Issuers must accept from Sept 1, 2015; applies to commercial + Medicaid/CHIP + ERS/TRS/UT/A&M plans (https://www.legis.state.tx.us/tlodocs/83R/analysis/html/SB00644F.htm; https://www.tdi.texas.gov/forms/lhlifehealth/nofr002-prior-authorization-form-prescription-drug-benefits.pdf; https://www.law.cornell.edu/regulations/texas/title-28/part-1/chapter-19/subchapter-S/division-3) |
| **MN** | Minn. Stat. 62J.497 (ePA statute) + MDH form | "Minnesota Uniform Form for Prescription Drug Prior Authorization Requests and Formulary Exceptions" | https://www.health.state.mn.us/facilities/ehealth/asa/rxpaform.html — MN also *mandates electronic* drug PA. |
| **AZ** | A.R.S. § 20-3406 | Uniform prior authorization request forms | https://www.azleg.gov/ars/20/03406.htm |
| **VT** | DFR-designated forms | Uniform medical & drug PA forms | https://dfr.vermont.gov/industry/insurance/health-insurance/prior-authorization-forms |
| **LA** | Uniform drug PA form (used incl. Medicaid MCOs) | https://ldh.la.gov/assets/docs/BayouHealth/Pharmacy/DrugPA_FormCoversheet.pdf | |

National count: AHIP's compendium "Uniform Drug Prior Authorization Forms: Summary of State
Requirements" (https://ahiporg-production.s3.amazonaws.com/documents/Drug-Prior-Authorization-Forms.pdf)
and PCG Health Policy (2018, https://pcghealthpolicy.com/2018/07/20/states-are-increasingly-turning-to-uniform-prior-authorization-forms/)
document the trend; search-level sources say "more than 10 states." **Exact current count
UNVERIFIED — treat as "at least ~a dozen," verify per-state before templating.** Other states
frequently cited with uniform/standard drug-PA forms include CO, IL, MI, NY (SB-supported),
OR, WA — UNVERIFIED here, not individually checked.

Takeaway for a PA-drafting feature: in uniform-form states, ONE template per state covers every
commercial payer (the payer-specific part collapses to criteria knowledge, not form layout); MA,
CA, TX are the strongest cases because acceptance is mandatory and MA/CA add deemed-approval or
response-deadline teeth.

### 2.2 The 2024-2026 state PA-reform wave

Volume: 10 states passed PA-reform legislation in 2024 (AMA,
https://www.ama-assn.org/practice-management/prior-authorization/10-states-have-tackled-prior-authorization-so-far-2024);
2025 session: 110+ PA bills tracked across 40 states (ASCO,
https://www.asco.org/news-initiatives/policy-news-analysis/states-lead-prior-authorization-reform);
NAIC published a Prior Authorization White Paper Dec 4, 2025
(https://content.naic.org/sites/default/files/inline-files/PA%20white%20paper%2012.4.2025%20final.pdf).
All accessed 2026-08-24.

| Reform type | States (as surfaced 2026-08-24) | Notes |
|---|---|---|
| **Gold-carding** (PA exemption for high-approval prescribers, typically >=90%) | TX (2021, first), AR, CO, LA, WV, WY pre-2025; AR/TX/WV amended 2025; **CA SB 306 eff. Jan 1, 2026** (services approved >=90% must be PA-exempt; approval-rate reporting by Jul 2026) | MultiState: https://www.multistate.us/insider/2025/8/14/prior-authorization-reform-gains-momentum-in-states; AJMC: https://www.ajmc.com/view/state-restrictions-on-prior-authorization |
| **AI-review restrictions** | **CA SB 1120** ("Physicians Make Decisions Act," eff. Jan 1, 2025): no autonomous AI denials; licensed clinician must make final determination; disclosure + audits (https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB1120). MD: patient-specific (not population) data for AI determinations + reporting. More states following per NAIC white paper. | Medscape: https://www.medscape.com/viewarticle/new-state-law-will-restrict-ai-prior-authorization-coverage-2024a1000krq |
| **Response deadlines / deemed approval** | Widespread in 2024-25 packages (e.g., 24-72h urgent, deemed-approved on timeout — MA's June 2026 regs (§4.2) are of this family) | Health Affairs Forefront 2025-11-21: https://www.healthaffairs.org/do/10.1377/forefront.20251121.817604/ |
| **PA elimination for categories of routine care** | MA 211 CMR 52 amendments (eff. Jun 5, 2026) — see §4.2 — among the most aggressive | |

---

## 3. Payer-built PA automation

All sources accessed 2026-08-24.

### 3.1 The June 2025 AHIP industry pledge — and its first-year record

- Announced June 23, 2025, convened by **AHIP + Blue Cross Blue Shield Association**; ~**50
  plans** signed including all six largest for-profit carriers (UnitedHealthcare, CVS/Aetna,
  Cigna, Elevance, Humana, Centene); press coverage put covered lives at ~257M (widely reported
  figure — from the pledge press materials, not independently verified here). AHIP press release:
  https://www.ahip.org/news/press-releases/health-plans-take-action-to-simplify-prior-authorization
  (403s WebFetch; contents reconstructed from KFF/AJMC/Becker's coverage).
- Commitments (per AJMC/KFF summaries):
  1. **Standardized electronic PA via FHIR APIs, operational by Jan 1, 2027** (all markets).
  2. **Demonstrated reductions in the scope of services subject to PA by Jan 1, 2026.**
  3. **90-day continuity**: honor a prior plan's existing authorizations for 90 days on plan
     switches, from Jan 1, 2026.
  4. Clearer transparency/communication on determinations and appeals, in 2026.
  5. **>=80% of electronic PA requests (with complete clinical documentation) answered in
     real time in 2027.**
  6. All clinical denials reviewed by medical professionals (affirmed as existing practice).
- **One year later** (KFF Health News, June 2026,
  https://kffhealthnews.org/insurance/prior-authorization-insurance-denials-reform-pledge-year-later/,
  fetched 2026-08-24): AHIP reports **6.5 million PAs eliminated (~11% reduction)** — but the
  figure "applies only to medical services, **not prescription medications**." No federal
  tracking dashboard exists; critics (Corlette, Rep. Murphy, patient advocates) call it
  unenforceable self-regulation. **Eight original signatories did not sign the April 2026
  technology update** (the FHIR-adoption commitment): Alignment, EmblemHealth, HealthFirst,
  Independent Health, Medica, MVP, **Point32Health**, SummaCare. Point32Health being on that
  list matters directly for the FirstPassRx pilot: its FHIR-ePA posture is now the least
  committed of the four pilot payers.

### 3.2 UnitedHealth / Optum

- **PreCheck MyScript** (Optum Rx, in-EHR since ~2017): real-time prescription benefit check at
  e-prescribing — shows member-specific cost, PA flags, and cheaper covered alternatives before
  the script is sent (background; the current flagship is below).
- **PreCheck Prior Authorization** (2025): automates PA creation/approval; Optum Rx says it cut
  approval time "from 8.5 hours to under 30 seconds"; by Jan 1, 2026 covers 45+ medications and
  ~20 health systems (Becker's:
  https://www.beckerspayer.com/payer/optum-rxs-prior-auth-tool-cuts-prescription-approvals-from-8-hours-to-30-seconds/).
- **Reauthorization elimination**: Optum Rx eliminated reauth for 40 drugs (2025), 40 more from
  Jan 1, 2026; ~180 medications now carry reduced reauthorization, surpassing its stated 25%
  reauth-reduction goal (UHC/Optum announcements via search 2026-08-24).
- **Gold Card program** (nationwide from Oct 1, 2024): qualifying provider groups skip PA for
  eligible codes; UHC says it cut PA volume ~30% for eligible groups in 2025
  (https://www.uhc.com/news-articles/newsroom/gold-card).

### 3.3 CVS Health / Caremark / Aetna

- Caremark ePA (https://www.caremark.com/pharmacists-medical-professionals/e-prior-authorization.html):
  NCPDP question-set flow (prescriber requests question set via EHR/portal → Caremark returns it →
  auto-adjudication); "some automated decisions in less than six seconds"; ePA handles PA,
  quantity-limit, and formulary-exception requests (not tier exceptions).
- **Novologix** = CVS's *medical-benefit* drug PA platform (used for Aetna specialty/precert
  drugs; also licensed to Blues plans) — relevant example of the medical-vs-pharmacy split
  (https://www.caresource.com/documents/cvs-novologix-epa-provider-user-guide/).
- Aetna has been trimming lower-complexity services off commercial precert lists through
  2025-2026 (search-level; part of the AHIP-pledge reductions).

### 3.4 Cigna / Express Scripts / EviCore

- Cigna announced a **15% cut in services requiring PA in 2025** and removed **345 codes** from
  PA; says a standardized approach will cover >70% of its PA volume
  (https://providernewsroom.com/cigna-healthcare/simplifying-and-reducing-prior-authorization-with-industry-peers/).
- **EviCore intelliPath**: single provider-facing PA-automation portal/platform spanning plans
  and procedures (https://www.evicore.com/solutions/provider/prior-authorization-automation/evicore-intellipath).
- 2026: Cigna is running a **strategic review of EviCore** (possible divestiture) — Becker's,
  https://www.beckerspayer.com/m-and-a/cigna-weighs-strategic-alternatives-for-prior-auth-utilization-management-subsidiary/.

### 3.5 Humana (+ Cohere Health)

- **Cohere Health** runs Humana's PA intake/automation for musculoskeletal (2021 pilot, 12
  states → all 50 by 2022), cardiovascular + surgical (2023), and diagnostic imaging + sleep
  (2024) (https://www.coherehealth.com/news/cohere-health-and-humana-expand-partnership;
  PRNewswire 302123731).
- July 2025 acceleration: eliminate ~**1/3 of outpatient PA requirements by Jan 1, 2026**
  (colonoscopies, TTEs, select CT/MRI); decision within one business day on >=95% of complete
  electronic PAs by Jan 1, 2026; a national **gold card** launches 2026
  (https://policy.humana.com/issue-area/news-and-resources/news-press/2025/humana-accelerates-efforts-to-eliminate-prior-authorization).

### 3.6 Elevance Health

- AHIP-pledge signatory; says it removed PA from "several hundred services," honors prior-plan
  authorizations on switches, adopting secure data-exchange platforms
  (https://www.elevancehealth.com/our-approach-to-health/whole-health/prior-authorization).
  UM subsidiary **Carelon Medical Benefits Management** (ex-AIM) posts PA-reform progress
  (https://www.carelon.com/perspectives/prior-authorization-reform-progress); CarelonRx pushes
  "proactive prior authorization" on the pharmacy side.

### 3.7 Payer AI-review controversy (brief)

- **UnitedHealth / nH Predict** (NaviHealth): Nov 2023 Minnesota federal class action over
  algorithmic post-acute-care denials in MA plans; plaintiffs allege a ~90% appeal-reversal rate.
  Feb 2025: contract/good-faith claims allowed to proceed (exhaustion excused as futile);
  Sept 2025: discovery-narrowing rejected; **Mar 2026: court ordered broad discovery on the
  algorithm** (several counts dismissed as Medicare-Act-preempted)
  (https://www.healthcarefinancenews.com/news/class-action-lawsuit-against-unitedhealths-ai-claim-denials-advances;
  https://distilinfo.com/2026/03/12/court-orders-unitedhealth-to-disclose-ai-denial-algorithm/).
- **Cigna / PxDx**: alleged batch auto-denials (300k+ claims in two months; "1.2 seconds per
  claim"); Mar 2025: California federal court let the class action proceed. Cigna: PxDx "does
  not use AI," applies to ~50 low-cost tests (same sources).
- These suits + CA SB 1120-style statutes (§2.2) are why payers now market their automation as
  "auto-APPROVAL only, never auto-denial" — Optum, Cohere, and Humana all frame it that way.
  A third-party drafting tool faces none of that exposure (it acts for the provider, not the
  payer), but the same scrutiny explains why payer-side automation keeps human denial review.

---

## 4. Massachusetts specifics

(Written before §2-3 because the state-law research surfaced it first; §2 cross-references.)

### 4.1 The Massachusetts standard PA form mandate — M.G.L. c. 176O, § 25

Statute text (https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXII/Chapter176O/Section25,
fetched 2026-08-24):

- "The division [of Insurance] shall develop and implement uniform prior authorization forms for
  different health care services and benefits."
- "Every provider shall use the appropriate uniform prior authorization form" and "every payer or
  any entity acting for a payer under contract shall accept the form."
- **Deemed-approval teeth:** "the prior authorization request shall be deemed to have been
  granted" if a payer fails to use/accept the required form **or does not respond within 2
  business days** of receiving a completed request.
- Electronic escape hatch: a payer may use "an internet webpage, internet webpage portal, or
  similar electronic, internet, and web-based system in lieu of a paper form," provided it's
  consistent with the uniform form; forms must be "electronically available" and "capable of
  being electronically accepted by the payer."
- Section applies to carriers regulated under c. 176O (commercial fully-insured plans). Origin:
  the 2012 cost-containment law (Ch. 224 of the Acts of 2012) — UNVERIFIED exact session-law
  section; the statute's existence and current text are verified above.

**The medication form itself:** "**Massachusetts Standard Form for Medication Prior Authorization
Requests**," v1.0 released May 2016 under **DOI Bulletin 2016-08** ("Prospective Review Forms for
Medication and Imaging Services"). Hosted on mass.gov as the attachment to Bulletin 2016-08
(https://www.mass.gov/doc/attachment-to-bulletin-2016-08-form1-medication/download) and
republished by carriers — e.g. BCBSMA's eForm instructions PDF
(https://www.bluecrossma.org/medical-policies/sites/g/files/csphws2091/files/acquiadam-assets/023%20E%20Form%20medication%20prior%20auth%20instruction%20prn.pdf)
and Harvard Pilgrim's portal page. Sections: patient info, prescriber info, medication requested,
clinical justification; supports initial vs. continuation and expedited/urgent flags. (Sources
surfaced in search 2026-08-24; mass.gov 403s direct fetches — Akamai bot-blocking — so form
contents beyond the search-visible description are drawn from carrier copies.)

DOI keeps designating NEW standard forms under § 25: a Nov 14, 2025 information session
considered proposed standard forms from the **Mass Collaborative** for Post-Acute Care and Home
Health (responding to Section 25 of Chapter 197 of the Acts of 2024) plus an amended ABA form
(https://www.mass.gov/event/information-session-on-proposed-standard-prior-authorization-forms-11-14-2025,
search-confirmed 2026-08-24). The Mass Collaborative (payer-provider consortium) is the body that
actually drafts these forms.

### 4.2 The June 2026 DOI regulations — PA eliminated for chronic-condition care (incl. asthma meds)

Directly material to the pilot drug (fluticasone HFA for asthma):

- Gov. Healey announced (Jan 14, 2026) DOI regulations to "eliminate prior authorization
  requirements for routine and essential health care, including cancer scans and **medications
  for chronic conditions like asthma, diabetes and heart disease**" (mass.gov press release,
  https://www.mass.gov/news/governor-healey-announces-final-regs-that-eliminate-prior-authorization-requirements-for-routine-and-essential-health-care;
  language as rendered in search results 2026-08-24 — mass.gov blocks direct fetch; same text
  mirrored at InsuranceNewsNet. WBUR coverage 2026-01-14:
  https://www.wbur.org/news/2026/01/14/healey-unveils-plan-to-reform-health-care-insurance-prior-authorization-requirements,
  fetched 2026-08-24 — uses diabetes as the worked example: "a patient with diabetes would not be
  subject to prior authorization for any care, devices or drugs tied to their chronic condition.")
- Vehicle: amendments to **211 CMR 52.00** (Managed Care Consumer Protections and Accreditation
  of Carriers); proposed amendments issued Jan 16, 2026; **final regs effective June 5, 2026**
  (NFP summary, https://www.nfp.com/insights/massachusetts-issues-new-prior-authorization-rules/,
  fetched 2026-08-24).
- Per the NFP summary of the final regs: no PA allowed for emergency/urgent care, primary care,
  preventive services, post-cancer-diagnosis imaging, maternity, outpatient SUD treatment, PT/OT,
  and "**medications for serious mental illness and certain chronic conditions**"; **24-hour
  response required for urgent health-sensitive PA requests**; authorizations for chronic-
  condition treatment last for the duration of treatment while stable; a new insurer must honor
  existing authorizations **at least 90 days** on mid-treatment plan switches; carriers must
  publicly post PA requirements and give advance notice of changes.
- Applicability caveat: 211 CMR 52 binds DOI-regulated carriers (fully-insured commercial
  plans — BCBSMA, Point32Health, MGB Health Plan commercial books). Self-insured ERISA plans and
  MassHealth are outside DOI jurisdiction. UNVERIFIED: the final reg text's exact drug-class
  list (whether every asthma controller, incl. fluticasone HFA, is PA-exempt vs. a
  carrier-defined chronic-condition list) — verify against the final 211 CMR 52 text and each
  carrier's implementation before assuming the pilot drug no longer needs commercial PA.
- Pending legislation on top of the regs: **H.4616, "An Act Improving the Health Insurance Prior
  Authorization Process"** (redraft released Oct 2025, 194th General Court) — would push
  automated/streamlined PA, continuity of care, transparency for AI-assisted utilization review,
  and a PA-impact task force reporting mid-2026 (ACR summary,
  https://www.acr.org/News-and-Publications/Massachusetts-Legislature-Updates-Prior-Authorization-Bill;
  bill text https://malegislature.gov/Bills/194/H4616.pdf; search-confirmed 2026-08-24; passage
  status as of today UNVERIFIED — still a bill, not law, per sources seen).
- DOI also published an **Examination Report on Massachusetts Health Insurance Prior
  Authorization Practices (2023 & 2024 data years, issued 2026)**
  (https://www.mass.gov/doc/examination-report-massachusetts-health-insurance-prior-authorization-practices-2023-and-2024-data-years-issued-2026/download,
  PDF, not fetched) — evidence DOI now audits carrier PA volumes/denials.

### 4.3 How MassHealth pharmacy PA actually works

All accessed 2026-08-24.

- **Who runs it:** UMass Chan Medical School's Office of Clinical Affairs / **Clinical Pharmacy
  Services** has managed MassHealth's pharmacy benefit **since 2001** (drug utilization review,
  benefit design, the Drug List) — https://www.umassmed.edu/news/news-archives/2011/01/drug_list_updated/.
  **Conduent** hosts the MassHealth Drug List site and the pharmacy claims/POPS infrastructure:
  the MHDL lives at **https://mhdl.pharmacy.services.conduent.com/MHDL/** (canonical entry:
  mass.gov/druglist). So the task-prompt's "UMass Clinical Pharmacy Services" AND "Conduent" are
  both right: UMass = clinical operations/DUR, Conduent = systems host.
- **masshealthdruglist.com is NXDOMAIN as of 2026-08-24** (checked via curl + nslookup — DNS does
  not resolve). Any FirstPassRx reference to that domain should point at mass.gov/druglist or the
  Conduent MHDL instead.
- **The PA form system:** the MHDL publishes a **per-drug/per-class PA form PDF** under stable
  numeric ids — pattern `https://mhdl.pharmacy.services.conduent.com/MHDL/pubdownloadpa.do?id=<n>`
  (e.g. id=10858 seen in search results), plus a general form ("MassHealth Drug Utilization
  Review Program" PA form, mirrored at eforms.com). Forms carry member info, prescriber info,
  drug/strength, clinical criteria checkboxes matching that drug's MHDL criteria.
- **Submission = still fax/phone-first for FFS:** MassHealth DUR Program, 333 South Street,
  Shrewsbury MA 01545; phone **(800) 745-7318**; **fax (877) 208-7428** (form headers, search-
  confirmed 2026-08-24). Pharmacy Facts / Pharmacy Bulletin 59 documented a PA mailing-address
  change (https://www.mass.gov/doc/pharmacy-bulletin-59-new-address-for-prior-authorization-requests-for-drugs/download).
  UNVERIFIED: whether MassHealth FFS also accepts pharmacy ePA via CoverMyMeds/Surescripts —
  search results did not show an FFS ePA channel (MCO/ACO channels below do exist).
- **Decision timeline (regulatory):** MassHealth must respond to a pharmacy PA request **within
  24 hours** (130 CMR 450.303 — https://www.law.cornell.edu/regulations/massachusetts/130-CMR-450-303)
  and must authorize a **>=72-hour emergency supply** while PA pends (130 CMR 406.422 —
  https://www.law.cornell.edu/regulations/massachusetts/130-CMR-406-422; both per federal
  SSA § 1927(d)(5)).
- **Unified formulary across all MassHealth plans:** effective **April 1, 2023**, all MassHealth
  plans — FFS, MCOs, and Accountable Care Partnership Plans (ACPPs) — must use the **MassHealth
  Drug List** for pharmacy coverage; the **Unified Pharmacy Product List (UPPL)** designates
  preferred vs non-preferred products per therapeutic class, binding the MCOs/ACPPs
  (mass.gov Pharmacy Facts, April 2023: https://www.mass.gov/doc/issue-1-april-2023-0/download;
  Point32Health provider notices on "MassHealth Unified Formulary":
  https://www.point32health.org/provider/masshealth-unified-formulary-and-prior-authorization-updates-012026).
  Consequence for FirstPassRx: for the MassHealth vertical, ONE criteria/form set covers FFS and
  every MCO/ACO — but each MCO/ACO still runs its own *intake channel* (below).

### 4.4 Pilot-payer PA submission channels (verified 2026-08-24)

**MassHealth FFS** — MHDL per-drug form → fax (877) 208-7428 / phone (800) 745-7318 (above).

**Mass General Brigham Health Plan (MassHealth ACO line)** — per
https://massgeneralbrighamhealthplan.org/providers/pharmacy-guidelines/masshealth (fetched
2026-08-24):
- Pharmacy-benefit drugs processed by **OptumRx**: phone 800-711-4555, **fax 844-403-1029**;
  accepts "either the MassHealth Prior Authorization Form or Standard Prior Authorization Form";
  criteria = MassHealth Drug List (mass.gov/druglist). Online ePA via **go.covermymeds.com/OptumRx**
  (search-confirmed; same channel listed for Fallon and Health New England).
- Medical-benefit drugs: **Prime Therapeutics** via provider portal or **GatewayPA.com**; phone
  833-895-2611; fax 888-656-6671.

**Point32Health (Tufts Health Plan + Harvard Pilgrim, commercial)** — per
https://www.point32health.org/provider/policies/pharmacy/requesting-authorization-pharmacy-and-medical-drugs/
(fetched 2026-08-24):
- Four channels: (1) **PromptPA** portal (drug-specific criteria, clinical attachments, status
  checks); (2) **ePA via the EMR, CoverMyMeds (pharmacy + medical drugs), or Surescripts
  (pharmacy only)**; (3) **fax** using the drug-specific form (fax numbers printed per-form);
  (4) mail to Harvard Pilgrim Health Care/Tufts Health Plan, Pharmacy Utilization Management
  Dept, 1 Wellness Way, Canton, MA 02021-1166.
- Separate Massachusetts standard-form listings exist for the HPHC and Tufts legacy brands.
  PBM = OptumRx (task-provided context, consistent with the OptumRx-routed CoverMyMeds channel;
  the fetched page itself does not name the PBM — UNVERIFIED on-page).
- Note from §3.1: Point32Health signed the June 2025 AHIP pledge but was one of 8 plans that
  did NOT sign the April 2026 FHIR-technology update.

**Blue Cross Blue Shield of Massachusetts (commercial)** — search-confirmed 2026-08-24:
- Accepts the **MA Standard Form for Medication PA as an eForm** (its own "434 Massachusetts
  standard form" PDF: https://www.bluecrossma.com/common/en_US/pdfs/New_SOB/00-0000_Prior-Auth_Request-Form.pdf;
  eForm instructions: bluecrossma.org "023 E Form medication prior auth instruction" PDF).
- Retail-pharmacy PA: Clinical Pharmacy Operations, phone **1-800-366-7778**, **fax
  1-800-583-6289** (Pharmacy Operations Dept, 25 Technology Place, Hingham MA 02043);
  professionally-administered/buy-&-bill drugs fax **1-888-641-5355**.
- Public criteria surface: the "Medication Lookup" tool (https://www.bluecrossma.org/medication/)
  plus numbered pharmacy medical policies (e.g. policy 049 Drug Management & Retail Pharmacy PA).
- PBM: **CVS Caremark since Jan 1, 2023** (commercial + Medicare; replaced Express Scripts) —
  BCBSMA press release Aug 16, 2021:
  https://newsroom.bluecrossma.com/2021-08-16-Blue-Cross-Blue-Shield-of-Massachusetts-Selects-CVS-Caremark-TM-as-its-Pharmacy-Benefit-Manager
  (search-confirmed 2026-08-24). Practical effect: BCBSMA pharmacy ePA rides Caremark's NCPDP
  question-set rails (§3.3) in addition to the MA-standard-form fax/eForm channel.

---

## 5. Implications for FirstPassRx

1. **CMS-0057-F does NOT obsolete a drug-PA drafting feature — drugs are expressly excluded**
   from both the Prior Authorization API and the PA process requirements ("of any type":
   prescription, pharmacy-dispensed, provider-administered), per CMS's own FAQ (§1.1). The
   federal ePA machinery being built for Jan 2027 is a *medical items-and-services* stack.
2. **The drug gap is closing, but slowly and partially.** CMS-0062-P (proposed Apr 2026,
   comments closed Jun 15, 2026, not final) would push NCPDP SCRIPT/F&B/RTPB onto Medicaid,
   CHIP, and FFE-QHP payers **starting Oct 1, 2027** — and its HIPAA-FHIR piece reaching all
   payers lands 24-36 months after finalization. Realistic window in which manual drug PA
   persists at scale: **through at least 2028**. And Massachusetts QHPs aren't even FFE plans,
   so the CMS QHP hooks miss the state's exchange entirely (§1.1).
3. **Massachusetts is close to a best-case templating jurisdiction**: one DOI-designated
   medication PA form every commercial carrier must accept (M.G.L. c. 176O § 25), with
   deemed-approval in 2 business days on non-response — pre-filling THE state form is legally
   grounded, not a courtesy. CA (61-211) and TX (NOFR002) offer the same play for expansion
   (§2.1). A drafted form is also a *forcing device*: completed + submitted = the 2-day clock.
4. **But the June 5, 2026 DOI regs may shrink the pilot's commercial demand**: 211 CMR 52.00
   amendments eliminate PA for chronic-condition medications — asthma named in the Healey
   announcement — for fully-insured commercial plans (§4.2). Before building payer flows for
   BCBSMA/Point32Health/MGB commercial around fluticasone HFA, verify per-carrier whether the
   pilot drug still carries PA at all post-June-2026. The feature's durable commercial value may
   sit in classes the regs don't reach (and in self-insured ERISA plans they can't reach).
5. **MassHealth is the pilot's most tractable and most durable lane**: one unified formulary
   (MHDL/UPPL) binds FFS + every MCO/ACPP since Apr 2023, per-drug PA form PDFs sit at stable
   Conduent URLs, decisions come inside a regulatory 24 hours, and a 72-hour emergency supply
   bridges the gap. Drafting = pre-filling the MHDL per-drug form. Note the DOI chronic-condition
   PA ban does NOT apply to MassHealth (§4.2, §4.3).
6. **Yes, fax is still how much of MA pharmacy PA gets filed.** MassHealth FFS PA is
   fax/phone-first (877-208-7428); BCBSMA takes the standard form by fax (800-583-6289); MGB's
   OptumRx lane has a fax (844-403-1029) beside CoverMyMeds; Point32Health prints fax numbers
   on each drug form. A "download the pre-filled PDF + right fax number" feature matches the
   real 2026 workflow; ePA portals (CoverMyMeds/Surescripts/PromptPA) are the parallel channel,
   not the replacement (§4.4, §1.4).
7. **The payer-side automation wave targets payer-side pain, not the prescriber's drafting
   burden.** AHIP-pledge reductions (6.5M PAs, 11%) are medical-services-only — explicitly not
   prescription drugs (§3.1). Optum's PreCheck, Caremark's <6-second ePA, EviCore intelliPath
   all *adjudicate faster* once a complete request arrives; none of them writes the clinical
   justification. Complementary, not competitive.
8. **A drafting tool inherits none of the AI-denial legal exposure** (nH Predict, PxDx suits;
   CA SB 1120-family laws) because those constrain payer-side *determinations*. But two design
   duties follow anyway: keep the prescriber visibly in control of clinical assertions
   (provider-of-record signs), and don't fabricate criteria answers — the payer's question set /
   form checkboxes are the contract (§3.7).
9. **Watch Point32Health**: it skipped the April 2026 AHIP FHIR-technology update (§3.1) —
   its ePA modernization is the least committed of the four pilot payers, which raises the
   relative value of a form/fax-capable drafting feature for Tufts/Harvard Pilgrim members.
10. **Correction to project context: masshealthdruglist.com does not resolve (NXDOMAIN,
    2026-08-24).** The PA-form system lives at mass.gov/druglist →
    mhdl.pharmacy.services.conduent.com. Use those hosts in any citation or deep link (§4.3).

---

*Research method note: mass.gov, cms.gov (WebFetch), ahip.org, and Becker's 403 direct fetches;
cms.gov yielded to curl with a browser UA; mass.gov did not (Akamai) — those facts carry
search-snippet or secondary-source citations instead, flagged inline. Federal Register pages
bot-block (unblock.federalregister.gov redirect). All URLs above were accessed or
search-surfaced 2026-08-24.*
