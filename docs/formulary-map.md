# FirstPassRx — state · plan · PBM · formulary map

> Auditable index of where each plan publishes its drug coverage. Every formulary links to its
> source. **Generated** from `src/data/formulary.json` (MA, MD — full drug-level data in the app)
> and `src/data/state-index.json` (NY, VA, DC — formulary links, drug-level data pending).
> Do not edit by hand — run `npm run build:map`. Verify links with `npm run trace:live`.
> Captured 2026-06-28. Scope: inhalers, menopause hormone therapy.

## Coverage status

| State | In app | Plans listed |
| --- | --- | --- |
| Massachusetts (MA) | inhaler guide — drug-level | 5 |
| Maryland (MD) | menopause hormone-therapy guide — drug-level | 8 |
| New York (NY) | ACE inhibitor guide — drug-level | 1 |
| Virginia (VA) | index only | 8 |
| District of Columbia (DC) | index only | 7 |

## Massachusetts (MA) — inhaler guide · in app

| Plan | Type | PBM | Published formulary (as of) |
| --- | --- | --- | --- |
| MassHealth | Medicaid | Conduent (PBA) | [MassHealth Drug List — Table 23: Respiratory Agents (Inhaled)](https://mhdl.pharmacy.services.conduent.com/MHDL/pubtheradetail.do?id=23) — eff. 2025-11 |
| Blue Cross Blue Shield of Massachusetts | Commercial | CVS Caremark | [Blue Cross Blue Shield of MA — Medication Look-up](https://provider.bluecrossma.com/ProviderHome/portal/home/pharmacy/formularies/medication-look-up) |
| Tufts Health Plan | Commercial | OptumRx | [Tufts Health Plan (Point32Health) — Value Direct 3-Tier Formulary, eff. Jan 1 2026](https://contenthub-aem.optumrx.com/content/dam/contenthub/rx-assets/en/documents/clients/harvard-pilgrim/p32-formulary-documents/2026/P32H-Value-Direct-3T-Comprehensive-Tufts.pdf) — eff. 2026-01-01 |
| Harvard Pilgrim Health Care | Commercial | OptumRx | [Harvard Pilgrim (Point32Health) — Select 3-Tier 2026 Prescription Drug List](https://contenthub-aem.optumrx.com/content/dam/contenthub/rx-assets/en/documents/clients/harvard-pilgrim/hphc-formulary-documents/2026-oe/HPHC-Select-3T-Comprehensive.pdf) — eff. 2025-10-01 |
| Mass General Brigham Health Plan | Commercial | Optum Rx | [Mass General Brigham Health Plan — 2026 6-Tier Commercial Pharmacy Formulary](https://fm.formularynavigator.com/FBO/192/20266T.pdf) — eff. 2026-06-01 |

## Maryland (MD) — menopause hormone-therapy guide · in app

| Plan | Type | PBM | Published formulary (as of) |
| --- | --- | --- | --- |
| Maryland Medicaid | Medicaid | Maryland Pharmacy Program (Conduent) | [Maryland Medicaid Preferred Drug List (PDL), eff. 1/1/2026 (upd. 3/26/2026)](https://health.maryland.gov/mmcp/pap/docs/PDL-1-1-2026-update-3-26-2026.pdf) — eff. 2026-01-01 |
| CareFirst BlueCross BlueShield | Commercial | CVS Caremark | [CareFirst BlueCross BlueShield — 2026 Exchange / Individual & Small Group Formulary](https://member.carefirst.com/carefirst-resources/pdf/exchange-formulary-sum7277-2026.pdf) — eff. 2026-06-01 |
| Kaiser Permanente Mid-Atlantic | Commercial | Kaiser Permanente (in-house) | [Kaiser Permanente Mid-Atlantic States — 2026 Marketplace Formulary (upd. 4/7/2026)](https://healthy.kaiserpermanente.org/content/dam/kporg/final/documents/formularies/mas/marketplace-formulary-mas-en.pdf) — eff. 2026-04-07 |
| Johns Hopkins Priority Partners | Medicaid MCO | Johns Hopkins HealthCare | [Priority Partners (690) Formulary, Effective 04/01/2026](https://www.ppmco.org/wp-content/uploads/2023/03/ppmco_formulary.pdf) — eff. 2026-04-01 |
| UnitedHealthcare | Commercial | OptumRx | [UnitedHealthcare Commercial Prescription Drug List (PDL), Effective January 1, 2026](https://www.uhcprovider.com/content/dam/provider/docs/public/resources/pharmacy/commercial-pdl-jan-2026.pdf) — eff. 2026-01-01 |
| Cigna HealthCare | Commercial | Express Scripts / Evernorth | [Cigna Healthcare Value 4-Tier Prescription Drug List — coverage starting July 1, 2026 (Hormonal Agents section, p.18)](https://www.cigna.com/static/www-cigna-com/docs/ifp/value-4-tier-spec.pdf) — eff. 2026-07-01 |
| Aetna | Commercial | CVS Caremark | [2026 Aetna Standard Plan Pharmacy Drug Guide — MENOPAUSAL SYMPTOM AGENTS / PROGESTINS covered list + 'Preferred Options List for Formulary Drug Removals' (estradiol, vaginal estrogen, progesterone entries)](https://www.aetna.com/content/dam/aetna/pdfs/aetnacom/individuals-families-health-insurance/document-library/pharmacy/2026_Drug_guide_Aetna_Standard_Plan.pdf) — eff. 2026-01 |
| Medicare Part D — AARP MedicareRx Preferred (UHC) | Medicare | OptumRx | [AARP Medicare Rx Preferred from UHC (PDP) — Complete Drug List (Formulary) 2026, Formulary ID 00026000, Estrogens / Progestins sections (pp. 70-74 index; drug list pp. ~70-72)](https://www.uhc.com/medicare/alphadog/PDEX26PD0348627_001) — eff. 2026-01-01 |

## New York (NY) — ACE inhibitor guide · in app

| Plan | Type | PBM | Published formulary (as of) |
| --- | --- | --- | --- |
| New York Medicaid (NYRx) | Medicaid | Prime Therapeutics / FHSC (NYRx fiscal agent) | [NYRx, the Medicaid Pharmacy Program Preferred Drug List (PDL) — revised June 4, 2026](https://newyork.fhsc.com/downloads/providers/NYRx_PDP_PDL.pdf) — eff. 2026-06-04 |

## Virginia (VA) — index only

> Medicaid MCOs follow the statewide DMAS Common Core Formulary / PDL.

| Plan | Type | PBM | Published formulary |
| --- | --- | --- | --- |
| Virginia Medicaid (Cardinal Care) Fee-for-Service | Medicaid (FFS) | Conduent (DMAS pharmacy benefits administrator / fiscal agent); statewide Common Core Formulary set by DMAS | [Virginia Medicaid Preferred Drug List (PDL) / Common Core Formulary](https://www.virginiamedicaidpharmacyservices.com/provider/preferred-drug-list/) — eff. 2026-04-01 |
| Anthem HealthKeepers Plus (Cardinal Care) | Medicaid MCO | CarelonRx | [Anthem HealthKeepers Plus VA Medicaid formulary search (follows statewide PDL / Common Core Formulary)](https://client.formularynavigator.com/Search.aspx?siteCode=1202239098) |
| Sentara Community Plan (Cardinal Care) | Medicaid MCO | Express Scripts | [Sentara Health Plans prescription drug lists (Medicaid / Sentara Community Plan; follows statewide PDL / Common Core Formulary)](https://www.sentarahealthplans.com/en/members/manage-plans/prescription-drug-lists) |
| UnitedHealthcare Community Plan of Virginia (Cardinal Care) | Medicaid MCO | OptumRx | [UnitedHealthcare Community Plan of Virginia pharmacy resources / PDL search (follows statewide PDL / Common Core Formulary)](https://www.uhcprovider.com/en/health-plans-by-state/virginia-health-plans/va-comm-plan-home/va-cp-pharmacy.html) |
| Aetna Better Health of Virginia (Cardinal Care) | Medicaid MCO | CVS Caremark | [Aetna Better Health of Virginia pharmacy & prescription drug benefits (formulary / drug-search landing page; follows statewide PDL / Common Core Formulary)](https://www.aetnabetterhealth.com/virginia/pharmacy-prescription-drug-benefits.html) ⚠️ (landing page only — drug list not directly reachable) |
| Anthem Blue Cross and Blue Shield (HealthKeepers, Inc.) - Commercial | Commercial | CarelonRx | [Anthem Virginia commercial/individual drug lists & formulary (Select / Essential / National drug lists, 2026)](https://www.anthem.com/va/pharmacy-information/drug-list-formulary) — eff. 2026-01-01 |
| Sentara Health Plans (Optima Health) - Commercial / Employer Group | Commercial | Express Scripts | [Sentara Health Plans employer-group / individual prescription drug lists & formularies (2026)](https://www.sentarahealthplans.com/en/members/manage-plans/employer-group-prescription-drug-lists) — eff. 2026-01-01 |
| Wellcare Value Script (PDP) - Medicare Part D | Medicare | Express Scripts | [Wellcare Value Script (PDP) 2026 Medicare Part D formulary / drug-list search tool (nationwide PDP, incl. Virginia)](https://www.wellcare.com/en/pdp-member/2026-value-script-formulary) — eff. 2026-01-01 |

## District of Columbia (DC) — index only

> DC Medicaid MCOs run their own formularies within DHCF rules.

| Plan | Type | PBM | Published formulary |
| --- | --- | --- | --- |
| DC Medicaid (Fee-for-Service) / DC Healthcare Alliance - Preferred Drug List | Medicaid (FFS) | Prime Therapeutics (administers pharmacy FFS for DC Dept. of Health Care Finance) | [District of Columbia Medicaid-Approved Preferred Drug List (PDL)](https://dc.fhsc.com/downloads/providers/DCRx_PDL_listing.pdf) — eff. 2026-03-23 |
| AmeriHealth Caritas District of Columbia (DC Healthy Families Medicaid MCO) | Medicaid MCO | PerformRx (AmeriHealth Caritas Family of Companies affiliate) | [AmeriHealth Caritas DC Drug Formulary (List of Covered Drugs)](https://www.amerihealthcaritasdc.com/pdf/member/drug-formulary.pdf) |
| MedStar Family Choice District of Columbia (DC Healthy Families Medicaid MCO) | Medicaid MCO | CVS Caremark | [DC Healthy Families Formulary (List of Covered Drugs), Effective 01/01/2026](https://www.medstarfamilychoicedc.com/-/media/project/mho/mfcdc/pharmacy-materials/medstar-dc-formulary-starting-1-1-2026.pdf) — eff. 2026-01-01 |
| Wellpoint District of Columbia (formerly Amerigroup; DC Healthy Families Medicaid MCO) | Medicaid MCO | CarelonRx | [Wellpoint DC Medicaid Pharmacy Benefits / Drug List (landing page; DC MCOs use the unified DC Medicaid PDL administered by Prime Therapeutics)](https://www.wellpoint.com/dc/medicaid/pharmacy) |
| CareFirst BlueCross BlueShield (Individual / Small Group / Exchange - DC Health Link) | Commercial | CVS Caremark | [CareFirst 2026 Exchange Formulary (List of Covered Drugs), applies to DC & MD individual/small group](https://member.carefirst.com/carefirst-resources/pdf/exchange-formulary-sum7277-2026.pdf) — eff. 2026-01-01 |
| Kaiser Permanente of the Mid-Atlantic States (Maryland / Virginia / DC - Marketplace/Commercial) | Commercial | Kaiser Permanente in-house pharmacy (integrated; no external PBM) | [Kaiser Permanente Mid-Atlantic Marketplace Formulary (List of Covered Drugs)](https://healthy.kaiserpermanente.org/content/dam/kporg/final/documents/formularies/mas/marketplace-formulary-mas-en.pdf) |
| CareFirst BlueCross BlueShield Medicare Advantage (PPO) - Group Advantage | Medicare | CVS Caremark | [CareFirst BlueCross BlueShield Group Advantage (PPO) 2026 Part D Formulary, updated 10/15/2025](https://individual.carefirst.com/carefirst-resources/pdf/2026-ma-formulary-ppo.pdf) — eff. 2026-01-01 |

---

Auditability: each in-app row cites the exact formulary document the app read (with its
effective date); each index-only row links the live formulary/PDL the index agent fetched.
`npm run trace:live` re-fetches every cited source and flags any that moved or 404d.
