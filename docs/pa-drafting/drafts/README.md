# Draft PAs — SAMPLE DATA ONLY

Two filled examples of what a one-click PA draft would produce for the pilot vertical
(Massachusetts × fluticasone propionate HFA). **Every patient, prescriber, and clinical value
is fabricated** (patient "SAMPLE, JANE Q", member ID `SAMPLE-00000000`, prescriber
"Alex Sample, MD", NPI `1234567893`) and each draft is stamped "NOT FOR SUBMISSION" in a
visible field. They demonstrate field mapping and criteria pre-fill, not real requests.

| File | Form filled | Scenario |
| --- | --- | --- |
| `draft-masshealth-fluticasone-hfa-SAMPLE.pdf` | MassHealth Inhaled Respiratory Agents PA Request (eff. 07/01/26), 7 pp | FFS member ≥ 12 with moderate persistent asthma; Section IV answered **Yes** (trial of two ICS) with Pulmicort Flexhaler + Arnuity Ellipta trials documented in Section XI; plan routing radio set to the FFS Drug Utilization Review Program (fax 877-208-7428) |
| `draft-tufts-fluticasone-hfa-SAMPLE.pdf` | MA Standard Form for Medication PA Requests (Feb 2024 v1.0, Tufts-branded), 3 pp | Tufts commercial step-therapy exception: Section F Q3 answered **Yes** (prior trial of the plan-preferred beclomethasone/QVAR generic, inadequate response), Section G clinical grid + previous-therapies table filled; Section A destination came pre-printed by the plan |

How they were produced (and why it generalizes): both blank forms are fillable AcroForms, so
values were written into the forms' own named fields — the same operation `pdf-lib` performs
client-side in a browser. Checkbox/radio placement was verified against rendered pages because
several field *names* on the MassHealth form are wrong (see the field-naming findings in
[../README.md](../README.md)); the per-payer field maps live in
[../templates/ma-ics-fluticasone-hfa.json](../templates/ma-ics-fluticasone-hfa.json).
