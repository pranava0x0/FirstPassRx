/**
 * Common ICD-10-CM codes per drug class, offered as suggestions in the PA request's diagnosis
 * field (free text still allowed). A short list a prescriber would actually pick from, not a
 * full code set. Billable (complete) codes only, titles as published.
 *
 * Checked against the official release below with `node scripts/check-icd10.mjs <order file>`;
 * every code exists and is billable. Re-run each October when CMS publishes the next fiscal year.
 */
export const ICD10_RELEASE = {
  version: 'ICD-10-CM FY2027 (effective 2026-10-01)',
  source: 'https://www.cms.gov/files/zip/2027-code-descriptions-tabular-order.zip',
  file: 'icd10cm_order_2027.txt',
  checkedAt: '2026-10-21',
}

export interface Icd10Option {
  code: string
  label: string
}

const ASTHMA: Icd10Option[] = [
  { code: 'J45.20', label: 'Mild intermittent asthma, uncomplicated' },
  { code: 'J45.30', label: 'Mild persistent asthma, uncomplicated' },
  { code: 'J45.40', label: 'Moderate persistent asthma, uncomplicated' },
  { code: 'J45.50', label: 'Severe persistent asthma, uncomplicated' },
  { code: 'J45.909', label: 'Unspecified asthma, uncomplicated' },
]
const COPD: Icd10Option[] = [
  { code: 'J44.9', label: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'J44.1', label: 'Chronic obstructive pulmonary disease with (acute) exacerbation' },
]
const T2D: Icd10Option[] = [
  { code: 'E11.9', label: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', label: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'E11.22', label: 'Type 2 diabetes mellitus with diabetic chronic kidney disease' },
]
const MENOPAUSE: Icd10Option[] = [
  { code: 'N95.1', label: 'Menopausal and female climacteric states' },
  { code: 'E28.310', label: 'Symptomatic premature menopause' },
]
const OSTEOPOROSIS: Icd10Option[] = [
  { code: 'M81.0', label: 'Age-related osteoporosis without current pathological fracture' },
  { code: 'M80.08XA', label: 'Age-related osteoporosis with current pathological fracture, vertebra(e), initial encounter for fracture' },
]

const ADHD: Icd10Option[] = [
  { code: 'F90.0', label: 'Attention-deficit hyperactivity disorder, predominantly inattentive type' },
  { code: 'F90.1', label: 'Attention-deficit hyperactivity disorder, predominantly hyperactive type' },
  { code: 'F90.2', label: 'Attention-deficit hyperactivity disorder, combined type' },
  { code: 'F90.9', label: 'Attention-deficit hyperactivity disorder, unspecified type' },
]
const LIPIDS: Icd10Option[] = [
  { code: 'E78.00', label: 'Pure hypercholesterolemia, unspecified' },
  { code: 'E78.011', label: 'Heterozygous familial hypercholesterolemia [HeFH]' },
  { code: 'E78.5', label: 'Hyperlipidemia, unspecified' },
  { code: 'I25.10', label: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
]
const OBESITY: Icd10Option[] = [
  // BMI codes (Z68.*) may only accompany a reportable diagnosis such as obesity (ICD-10-CM
  // guidelines), so they are named in the label as the second code, never offered alone.
  { code: 'E66.9', label: 'Obesity, unspecified (add the BMI code, Z68.30-Z68.45, as a second diagnosis)' },
  { code: 'E66.01', label: 'Morbid (severe) obesity due to excess calories (add the BMI code, e.g. Z68.41)' },
]
const MIGRAINE: Icd10Option[] = [
  { code: 'G43.909', label: 'Migraine, unspecified, not intractable, without status migrainosus' },
  { code: 'G43.009', label: 'Migraine without aura, not intractable, without status migrainosus' },
  { code: 'G43.109', label: 'Migraine with aura, not intractable, without status migrainosus' },
  { code: 'G43.709', label: 'Chronic migraine without aura, not intractable, without status migrainosus' },
]

// Named one by one: noUncheckedIndexedAccess types LIST[0] as possibly undefined.
const SCZ: Icd10Option = { code: 'F20.9', label: 'Schizophrenia, unspecified' }
const SCZA: Icd10Option = { code: 'F25.9', label: 'Schizoaffective disorder, unspecified' }
const BP: Icd10Option = { code: 'F31.9', label: 'Bipolar disorder, unspecified' }
const MDD: Icd10Option = { code: 'F33.1', label: 'Major depressive disorder, recurrent, moderate' }
const DEPRESSION: Icd10Option[] = [
  { code: 'F32.9', label: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.1', label: 'Major depressive disorder, recurrent, moderate' },
  { code: 'F33.9', label: 'Major depressive disorder, recurrent, unspecified' },
]
const ECZEMA: Icd10Option[] = [
  { code: 'L20.9', label: 'Atopic dermatitis, unspecified' },
  { code: 'L20.89', label: 'Other atopic dermatitis' },
]
const INSOMNIA: Icd10Option[] = [
  { code: 'G47.00', label: 'Insomnia, unspecified' },
  { code: 'F51.01', label: 'Primary insomnia' },
]
const RA: Icd10Option = { code: 'M06.9', label: 'Rheumatoid arthritis, unspecified' }
const PSA: Icd10Option = { code: 'L40.50', label: 'Arthropathic psoriasis, unspecified' }
const PSO: Icd10Option = { code: 'L40.0', label: 'Psoriasis vulgaris' }
const CD: Icd10Option = { code: 'K50.90', label: "Crohn's disease, unspecified, without complications" }
const UC: Icd10Option = { code: 'K51.90', label: 'Ulcerative colitis, unspecified, without complications' }
const AS: Icd10Option = { code: 'M45.9', label: 'Ankylosing spondylitis of unspecified sites in spine' }
const HTN: Icd10Option = { code: 'I10', label: 'Essential (primary) hypertension' }
const OAB: Icd10Option[] = [
  { code: 'N32.81', label: 'Overactive bladder' },
  { code: 'N39.41', label: 'Urge incontinence' },
]

export const ICD10_BY_CLASS: Record<string, Icd10Option[]> = {
  // Class-wide lists hold only what every agent in the class is labeled for; DRUG_ICD10 below adds
  // each drug's other indications (paliperidone is not labeled for bipolar or MDD).
  'antipsychotic-oral': [SCZ],
  'antipsychotic-lai': [SCZ],
  snri: [...DEPRESSION, { code: 'F41.1', label: 'Generalized anxiety disorder' }, { code: 'E11.42', label: 'Type 2 diabetes mellitus with diabetic polyneuropathy' }, { code: 'M79.7', label: 'Fibromyalgia' }],
  bupropion: DEPRESSION,
  'antidepressant-other': DEPRESSION,
  'topical-steroid': [...ECZEMA, { code: 'L40.0', label: 'Psoriasis vulgaris' }, { code: 'L30.9', label: 'Dermatitis, unspecified' }],
  'topical-nonsteroid': [...ECZEMA, { code: 'L40.0', label: 'Psoriasis vulgaris' }],
  'topical-acne': [{ code: 'L70.0', label: 'Acne vulgaris' }],
  'ad-biologic': ECZEMA,
  'z-drug': INSOMNIA,
  dora: INSOMNIA,
  benzodiazepine: [
    { code: 'F41.1', label: 'Generalized anxiety disorder' },
    { code: 'F41.0', label: 'Panic disorder [episodic paroxysmal anxiety]' },
    { code: 'F41.9', label: 'Anxiety disorder, unspecified' },
  ],
  // Shared by every TNF agent (adalimumab, etanercept, certolizumab, golimumab); DRUG_ICD10 adds
  // psoriasis/IBD per product (etanercept has no IBD indication).
  'tnf-inhibitor': [RA, PSA, AS],
  // Shared by every IL-17 and IL-23 agent (ixekizumab, secukinumab, ustekinumab...): psoriasis and
  // PsA. Crohn's/UC are ustekinumab/risankizumab/guselkumab-only, so they are left out.
  'il17-il23': [PSO, PSA],
  // Tofacitinib and upadacitinib (the MA picks) are labeled for RA, PsA, AS and UC -- not plaque
  // psoriasis; Crohn's is upadacitinib-only, so it is left out of the class-wide list.
  'jak-inhibitor': [RA, PSA, UC, AS],
  'opioid-ir': [
    { code: 'G89.18', label: 'Other acute postprocedural pain' },
    { code: 'G89.11', label: 'Acute pain due to trauma' },
    { code: 'M54.50', label: 'Low back pain, unspecified' },
  ],
  gabapentinoid: [
    { code: 'B02.29', label: 'Other postherpetic nervous system involvement' },
    { code: 'E11.42', label: 'Type 2 diabetes mellitus with diabetic polyneuropathy' },
    { code: 'G62.9', label: 'Polyneuropathy, unspecified' },
    { code: 'M79.7', label: 'Fibromyalgia' },
  ],
  'muscle-relaxant': [
    { code: 'M62.830', label: 'Muscle spasm of back' },
    { code: 'M62.838', label: 'Other muscle spasm' },
  ],
  testosterone: [
    { code: 'E29.1', label: 'Testicular hypofunction' },
    { code: 'E23.0', label: 'Hypopituitarism' },
  ],
  'oab-antimuscarinic': OAB,
  'oab-beta3': OAB,
  arb: [HTN, { code: 'E11.22', label: 'Type 2 diabetes mellitus with diabetic chronic kidney disease' }, { code: 'I50.9', label: 'Heart failure, unspecified' }],
  ccb: [HTN, { code: 'I20.9', label: 'Angina pectoris, unspecified' }],
  'beta-blocker': [HTN, { code: 'I50.9', label: 'Heart failure, unspecified' }, { code: 'I25.10', label: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' }],
  thiazide: [HTN, { code: 'R60.9', label: 'Edema, unspecified' }],
  'hiv-prep': [
    { code: 'Z29.81', label: 'Encounter for HIV pre-exposure prophylaxis' },
    { code: 'Z20.6', label: 'Contact with and (suspected) exposure to human immunodeficiency virus [HIV]' },
    { code: 'Z11.4', label: 'Encounter for screening for human immunodeficiency virus [HIV]' },
  ],
  'hiv-art': [
    { code: 'B20', label: 'Human immunodeficiency virus [HIV] disease' },
    { code: 'Z21', label: 'Asymptomatic human immunodeficiency virus [HIV] infection status' },
  ],
  'hcv-daa': [{ code: 'B18.2', label: 'Chronic viral hepatitis C' }],
  'stimulant-mph': ADHD,
  'stimulant-amph': ADHD,
  'adhd-nonstimulant': ADHD,
  statin: LIPIDS,
  ezetimibe: LIPIDS,
  pcsk9: LIPIDS,
  'aom-glp1': OBESITY,
  'aom-oral': OBESITY,
  triptan: MIGRAINE,
  'gepant-acute': MIGRAINE,
  'cgrp-preventive': MIGRAINE,
  saba: [...ASTHMA, ...COPD],
  ics: ASTHMA,
  icslaba: [...ASTHMA, ...COPD],
  lama: [...COPD, ...ASTHMA],
  metformin: T2D,
  'metformin-oral': T2D,
  sglt2: [...T2D, { code: 'I50.9', label: 'Heart failure, unspecified' }, { code: 'N18.30', label: 'Chronic kidney disease, stage 3 unspecified' }],
  glp1: T2D,
  insulin: [...T2D, { code: 'E10.9', label: 'Type 1 diabetes mellitus without complications' }],
  'ace-inhibitor': [
    { code: 'I10', label: 'Essential (primary) hypertension' },
    { code: 'I50.9', label: 'Heart failure, unspecified' },
    { code: 'E11.22', label: 'Type 2 diabetes mellitus with diabetic chronic kidney disease' },
  ],
  'nsaid-oral': [
    { code: 'M17.11', label: 'Unilateral primary osteoarthritis, right knee' },
    { code: 'M17.12', label: 'Unilateral primary osteoarthritis, left knee' },
    { code: 'M19.90', label: 'Unspecified osteoarthritis, unspecified site' },
    { code: 'M06.9', label: 'Rheumatoid arthritis, unspecified' },
    { code: 'M54.50', label: 'Low back pain, unspecified' },
  ],
  'ssri-oral': [
    { code: 'F32.9', label: 'Major depressive disorder, single episode, unspecified' },
    { code: 'F33.1', label: 'Major depressive disorder, recurrent, moderate' },
    { code: 'F41.1', label: 'Generalized anxiety disorder' },
    { code: 'F41.0', label: 'Panic disorder [episodic paroxysmal anxiety]' },
    { code: 'F42.2', label: 'Mixed obsessional thoughts and acts' },
  ],
  'est-oral': MENOPAUSE,
  'est-td': MENOPAUSE,
  combo: MENOPAUSE,
  progestogen: [...MENOPAUSE, { code: 'Z79.890', label: 'Hormone replacement therapy' }],
  vaginal: [{ code: 'N95.2', label: 'Postmenopausal atrophic vaginitis' }, ...MENOPAUSE],
  'oral-bisphosphonate': OSTEOPOROSIS,
  'iv-bisphosphonate': OSTEOPOROSIS,
  'rankl-inhibitor': OSTEOPOROSIS,
  anabolic: OSTEOPOROSIS,
  serm: OSTEOPOROSIS,
  'doac-anticoagulant': [
    { code: 'I48.91', label: 'Unspecified atrial fibrillation' },
    { code: 'I48.0', label: 'Paroxysmal atrial fibrillation' },
    { code: 'I82.409', label: 'Acute embolism and thrombosis of unspecified deep veins of unspecified lower extremity' },
    { code: 'I26.99', label: 'Other pulmonary embolism without acute cor pulmonale' },
  ],
}


/**
 * Per-drug lists, checked before the class list, so the PA builder never suggests a diagnosis the
 * requested drug is not labeled for (first match wins; matched against the PA item's drug text).
 */
const DRUG_ICD10: [RegExp, Icd10Option[]][] = [
  // Long-acting injectable brands first: several carry fewer indications than the oral molecule.
  [/aristada|aripiprazole lauroxil|perseris|uzedy/i, [SCZ]],
  [/maintena|asimtufii|risperdal consta|rykindo|microsphere/i, [SCZ, BP]],
  [/paliperidone|invega/i, [SCZ, SCZA]],
  [/clozapine|clozaril|versacloz|xanomeline|cobenfy|haloperidol decanoate|fluphenazine decanoate/i, [SCZ]],
  [/iloperidone|fanapt/i, [SCZ, BP]],
  [/aripiprazole|abilify|aristada|cariprazine|vraylar/i, [SCZ, BP, MDD]],
  [/brexpiprazole|rexulti/i, [SCZ, MDD]],
  [/quetiapine|seroquel|olanzapine|zyprexa|risperidone|risperdal|perseris|uzedy|rykindo|lurasidone|latuda|asenapine|ziprasidone|lumateperone|caplyta/i, [SCZ, BP]],
  [/upadacitinib|rinvoq/i, [RA, PSA, AS, UC, CD]],
  [/tofacitinib|xeljanz/i, [RA, PSA, AS, UC]],
  [/baricitinib|olumiant/i, [RA]],
  [/abrocitinib|cibinqo/i, ECZEMA],
  [/mirikizumab|omvoh|vedolizumab|entyvio/i, [CD, UC]],
  [/tildrakizumab|ilumya|brodalumab|siliq/i, [PSO]],
  [/adalimumab|humira|hadlima|hyrimoz|cyltezo|yusimry|simlandi|amjevita|hulio|idacio|yuflyma|infliximab|remicade|inflectra|renflexis|avsola|zymfentra/i, [RA, PSA, AS, PSO, CD, UC]],
  [/etanercept|enbrel|erelzi|eticovo/i, [RA, PSA, AS, PSO]],
  [/certolizumab|cimzia/i, [RA, PSA, AS, PSO, CD]],
  // Simponi Aria (IV) has no UC indication; subcutaneous Simponi does.
  [/simponi aria|golimumab.*(\bIV\b|intravenous|aria)/i, [RA, PSA, AS]],
  [/golimumab|simponi/i, [RA, PSA, AS, UC]],
  [/deucravacitinib|sotyktu|apremilast|otezla/i, [PSO, PSA]],
  [/ustekinumab|stelara|wezlana|selarsdi|pyzchiva|otulfi|imuldosa|yesintek|steqeyma|starjemza|risankizumab|skyrizi|guselkumab|tremfya/i, [PSO, PSA, CD, UC]],
  [/secukinumab|cosentyx|ixekizumab|taltz|bimekizumab|bimzelx/i, [PSO, PSA, AS]],
]

export function icd10For(classId: string, drug?: string): Icd10Option[] {
  const byDrug = drug ? DRUG_ICD10.find(([re]) => re.test(drug)) : undefined
  return byDrug?.[1] ?? ICD10_BY_CLASS[classId] ?? []
}
