/**
 * Static guidance on writing a strong PA appeal, shown next to the pre-filled letter.
 * Drawn from published appeal checklists and regulator guides — cited inline so a
 * reader can go deeper. No patient data; pure reference content.
 */
export function AppealTips() {
  return (
    <details className="appeal-tips">
      <summary>How to write a strong appeal</summary>
      <div className="appeal-tips__body">
        <ul className="appeal-tips__list">
          <li>
            <b>Start from the denial letter.</b> It names the exact denial reason, the deadline to
            appeal, and where to send it. Your letter should answer that stated reason head-on —
            not argue in general.
          </li>
          <li>
            <b>Facts, not feelings.</b> Dates, doses, and documented outcomes persuade reviewers;
            "this is unfair" does not. Keep the letter to one or two pages and let the enclosed
            Letter of Medical Necessity carry the clinical detail.
          </li>
          <li>
            <b>Address each preferred alternative by name.</b> The single strongest
            medical-necessity argument is showing the plan's own preferred drugs were tried and
            failed (or are contraindicated), one by one. The pre-filled list in the letter comes
            from this plan's formulary — fill in the dates and outcomes for each.
          </li>
          <li>
            <b>Include the codes.</b> The ICD-10 diagnosis code and any denial code from the letter
            route the appeal to the right reviewer and tie it to the right claim.
          </li>
          <li>
            <b>Cite the plan's own criteria.</b> Ask for the medical policy the denial relied on and
            address its requirements point by point. A denial that steps outside its own written
            policy is the easiest to overturn.
          </li>
          <li>
            <b>Ask for expedited review only when delay risks health.</b> Expedited appeals are
            typically decided within 72 hours, but require a prescriber's statement that waiting
            would jeopardize the patient. Don't mark a routine appeal urgent — it slows things down
            when the plan reclassifies it.
          </li>
          <li>
            <b>Keep proof of everything.</b> Send by fax or portal with confirmation (or certified
            mail), and keep copies of the letter and every enclosure. If the internal appeal fails,
            you can request an independent external review — the plan's final denial letter must
            tell you how.
          </li>
        </ul>
        <div className="appeal-tips__example">
          <p className="appeal-tips__example-label">Weak vs. strong, same argument:</p>
          <p className="appeal-tips__weak">
            "I really need this medication and the denial is unfair."
          </p>
          <p className="appeal-tips__strong">
            "I took metformin ER 1000&nbsp;mg from January to April 2026; it was stopped for
            persistent GI intolerance documented in my chart (see enclosed records). Under the
            plan's own step-therapy criteria, failure of the preferred agent satisfies the
            requirement for coverage."
          </p>
        </div>
        <p className="appeal-tips__sources">
          Based on published appeal guides:{' '}
          <a
            href="https://www.patientadvocate.org/download-view/sample-appeal-letter-for-pre-authorization-denial/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Patient Advocate Foundation
          </a>
          {' · '}
          <a
            href="https://www.insurance.wa.gov/appealing-health-insurance-denial"
            target="_blank"
            rel="noopener noreferrer"
          >
            WA Insurance Commissioner
          </a>
          {' · '}
          <a
            href="https://www.healthcare.gov/appeal-insurance-company-decision/internal-appeals/"
            target="_blank"
            rel="noopener noreferrer"
          >
            HealthCare.gov internal appeals
          </a>
          . Appeal deadlines and decision timeframes vary by plan type — the denial letter's own
          numbers govern.
        </p>
      </div>
    </details>
  )
}
