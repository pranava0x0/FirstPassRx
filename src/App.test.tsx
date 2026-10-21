import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import App from './App'

/** The preferred-agent name is the level-3 heading in the recommendation hero box. */
function agentHeading() {
  return within(screen.getByRole('tabpanel')).getByRole('heading', { level: 3 })
}

/**
 * State + prescription type are two independent controls now — set both to reach a guide.
 * Guide chunks are lazy-loaded, and a state can already have a guide for the *current* topic
 * (e.g. a state with several topics), so the state click alone can trigger an intermediate async
 * guide swap before the topic click ever happens. `Controls` disables every state/topic tab while
 * a guide is loading (`disabled={loadingGuideId !== null}`) to prevent exactly the race this would
 * otherwise create -- so clicking the topic tab too soon (while still disabled from the state
 * click's own load) silently no-ops. Real users never hit this (a lazy-loaded JSON chunk resolves
 * in a few ms, far faster than a human's next click); wait for the tab to be enabled again before
 * clicking it, the same way a real user's click would simply land after the button re-enables.
 */
async function switchGuide(user: ReturnType<typeof userEvent.setup>, stateName: RegExp, topicName: RegExp) {
  const stateSelect = screen.getByLabelText(/^State$/) as HTMLSelectElement
  const stateOpt = [...stateSelect.options].find((o) => stateName.test(o.textContent ?? ''))!
  await user.selectOptions(stateSelect, stateOpt.value)
  await waitFor(() => expect(screen.getByLabelText(/^Condition$/)).toBeEnabled())
  const topicSelect = screen.getByLabelText(/^Condition$/) as HTMLSelectElement
  const topicOpt = [...topicSelect.options].find((o) => topicName.test(o.textContent ?? ''))!
  await user.selectOptions(topicSelect, topicOpt.value)
  await waitFor(() => {
    expect(topicSelect.value).toBe(topicOpt.value)
    expect(screen.queryByText(/^Loading$/)).not.toBeInTheDocument()
  })
}

/** Selected option text of a labelled select. */
function selectedText(label: RegExp) {
  const el = screen.getByLabelText(label) as HTMLSelectElement
  return el.options[el.selectedIndex]?.textContent ?? ''
}

describe('FirstPassRx app', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })
  it('renders the masthead and the persistent reference-only disclaimer', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FirstPassRx')
    expect(screen.getByRole('note', { name: /data disclaimer/i })).toBeInTheDocument()
  })

  it('defaults to MassHealth SABA and shows the verified BOGL brand-required warning', () => {
    render(<App />)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')
    expect(screen.getByText(/Ask for the brand name/i)).toBeInTheDocument()
    // Coverage workflow stays explicit without exposing unsourced clinical dosing.
    const doctorLi = screen.getByText(/Doctor:/i).closest('li')
    expect(doctorLi).toHaveTextContent(/write Ventolin HFA on the prescription, not generic albuterol/i)
    expect(screen.getByText(/Patient:/i).closest('li')).toHaveTextContent(/exact benefit product/i)

    expect(screen.queryByText(/generic OK/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Q4-6H PRN/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/90 micrograms per puff/i)).not.toBeInTheDocument()
  })

  it('does not render clinical dosing or paste-ready prescription text', () => {
    render(<App />)
    expect(screen.queryByText(/Prescription text for clinician/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy sig/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Usual use:/i)).not.toBeInTheDocument()
  })

  it('switches to a non-BOGL product and keeps the result coverage-only', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/select insurance plan/i), {
      target: { value: 'bcbsma' },
    })
    expect(screen.queryByText(/Use brand name/i)).not.toBeInTheDocument()
    expect(screen.getByText(/a generic is fine/i)).toBeInTheDocument()
    expect(document.querySelector('.recommendation-label')).toHaveTextContent(/Preferred option/i)
  })

  it('lists reject drugs with reasons and disables the biologics tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 5, name: /Levalbuterol \(Xopenex HFA\)/ })).toBeInTheDocument()
    expect(document.querySelector('.pa-summary')).toHaveTextContent(/Needs plan approval:.*Levalbuterol/)
    expect(screen.getAllByText(/PA Required/i).length).toBeGreaterThan(0)
    const biologics = screen.getByRole('tab', { name: /biologics/i })
    expect(biologics).toHaveAttribute('aria-disabled', 'true')
    await user.click(biologics)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')
  })

  it('drafts and copies a pre-filled PA appeal letter for a rejected drug', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<App />)

    const rejectCard = screen.getByRole('heading', { level: 5, name: /Levalbuterol \(Xopenex HFA\)/ }).closest('.rx-option-card')
    expect(rejectCard).not.toBeNull()
    const within_ = within(rejectCard as HTMLElement)
    await user.click(within_.getByRole('button', { name: /draft appeal letter/i }))

    const letter = within_.getByRole('textbox', { name: /editable pa appeal letter/i }) as HTMLTextAreaElement
    expect(letter.value).toContain('Levalbuterol (Xopenex HFA)')
    expect(letter.value).toContain('MassHealth')

    await user.click(within_.getByRole('button', { name: /copy appeal letter/i }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Levalbuterol (Xopenex HFA)'))
  })

  it('regenerates an open appeal letter when the payer changes for the same-named barrier drug', async () => {
    // Regression test: "estropipate oral tablet" is a PA barrier under both Priority Partners and
    // Medicare Part D in the MD menopause guide -- same row.drug at the same list position, so
    // AppealAction's component instance is reused across the payer switch (React keys by
    // row.drug, not by payer). A useState lazy initializer would keep showing the old payer's
    // letter here; this asserts it rebuilds instead.
    const user = userEvent.setup()
    render(<App />)
    await switchGuide(user, /Maryland/i, /Menopause HT/i)
    await screen.findByRole('tab', { name: /Estrogen pill/i })
    fireEvent.change(screen.getByLabelText(/select insurance plan/i), { target: { value: 'priority-partners' } })
    await user.click(screen.getByRole('tab', { name: /Estrogen pill/i }))

    const card = screen.getByRole('heading', { level: 5, name: /estropipate oral tablet/i }).closest(
      '.rx-option-card',
    ) as HTMLElement
    await user.click(within(card).getByRole('button', { name: /draft appeal letter/i }))
    const letter = within(card).getByRole('textbox', { name: /editable pa appeal letter/i }) as HTMLTextAreaElement
    expect(letter.value).toContain('Priority Partners')

    fireEvent.change(screen.getByLabelText(/select insurance plan/i), { target: { value: 'medicare-partd' } })
    await user.click(screen.getByRole('tab', { name: /Estrogen pill/i }))

    const sameCard = screen.getByRole('heading', { level: 5, name: /estropipate oral tablet/i }).closest(
      '.rx-option-card',
    ) as HTMLElement
    const updatedLetter = within(sameCard).getByRole('textbox', {
      name: /editable pa appeal letter/i,
    }) as HTMLTextAreaElement
    expect(updatedLetter.value).toContain('Medicare Part D')
    expect(updatedLetter.value).not.toContain('Priority Partners')
  })

  it('changes the preferred agent when the class tab changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /Daily combo controller/ }))
    expect(agentHeading()).toHaveTextContent('Symbicort')
  })

  it('shows source citations with working links in the appendix', () => {
    render(<App />)
    const panel = screen.getByRole('tabpanel')
    const sources = within(panel).getByRole('region', { name: /sources/i })
    const links = within(sources).getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
  })

  it('prescribing options render as a table: recommended row + also-covered alternatives + rejects', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /Daily combo controller/ }))
    const panel = screen.getByRole('tabpanel')
    // the options table — recommended pick + the also-covered combos
    expect(within(panel).getByText(/FIRST-PASS RECOMMENDED/i)).toBeInTheDocument()
    const options = within(panel).getByRole('region', { name: /prescribing options/i })
    expect(within(options).getByText(/Advair Diskus/)).toBeInTheDocument()
    expect(within(options).getByText(/Breo Ellipta/)).toBeInTheDocument()
    expect(within(options).getAllByRole('link', { name: /GoodRx/i }).length).toBeGreaterThan(0)
    // rejects/barriers sit inside the same options table
    expect(within(options).getByText(/AirDuo RespiClick/)).toBeInTheDocument()
  })

  it('opens a plain-language glossary definition on tap', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /brand-over-generic rule/i }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/brand/i)
  })

  it('toggles to the Maryland menopause guide: new region, plans, classes, and agent', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Default guide is MA inhalers.
    expect(selectedText(/^Condition$/)).toMatch(/Inhalers/i)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')

    await switchGuide(user, /Maryland/i, /Menopause HT/i)

    // Masthead, class legend, plan list, and the result all swap to the menopause guide.
    expect(selectedText(/^Condition$/)).toMatch(/Menopause HT/i)
    expect(screen.getByText(/Prescription type/i, { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Maryland Medicaid/i })).toBeInTheDocument()
    expect(agentHeading()).toHaveTextContent(/Estradiol/i)
    // Inhaler-specific plans are gone.
    expect(screen.queryByRole('option', { name: 'MassHealth' })).not.toBeInTheDocument()
  })

  it('loads a non-default guide directly from the URL', async () => {
    window.history.replaceState({}, '', '/?guide=va-diabetes')
    render(<App />)
    // The shared link must survive the first render, before the linked guide has loaded.
    expect(window.location.search).toBe('?guide=va-diabetes')
    expect(await screen.findByRole('option', { name: /Virginia Medicaid/i })).toBeInTheDocument()
    expect(selectedText(/^State$/)).toMatch(/Virginia/i)
    expect(selectedText(/^Condition$/)).toMatch(/^Diabetes$/i)
  })

  // The "Not covered yet" empty state (App.tsx's `!activeGuideId` branch) is real defensive code,
  // but as of 2026-07-07 the 5-state x 5-topic grid (MA/MD/NY/VA/IL) is fully filled -- every
  // combination the state/topic tabs can select maps to a real guide, so there's no reachable
  // state/topic pair left to exercise this branch through the picker. Re-add a test for it once a
  // 6th state or a 6th topic ships with partial coverage (see backlog.md).

  it('names the exact benefit product instead of implying carrier-wide coverage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await switchGuide(user, /Maryland/i, /Menopause HT/i)
    fireEvent.change(screen.getByLabelText(/select insurance plan/i), { target: { value: 'uhc-md' } })
    expect(screen.getByRole('option', { name: /UnitedHealthcare 2026 Commercial PDL/i })).toBeInTheDocument()
    expect(screen.getByText(/Preferred option/i)).toBeInTheDocument()
    expect(screen.getByText(/Commercial PDL Jan 2026/i)).toBeInTheDocument()
  })

  it('cites the source inline and shows in-plan + cash cost in the options table', () => {
    render(<App />)
    const panel = screen.getByRole('tabpanel')
    // the answer cites its source inline (provenance line links to the formulary; the appendix
    // citation links to the same source, so there's more than one)
    const cite = within(panel).getAllByRole('link', { name: /MassHealth Drug List/i })
    expect(cite[0]).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
    // cost shows as columns: in-plan and cash
    expect(within(panel).getByText(/In plan:/i)).toBeInTheDocument()
    // cash links per option — GoodRx and Cost Plus Drugs
    const goodrx = within(panel).getAllByRole('link', { name: /GoodRx/i })
    expect(goodrx.length).toBeGreaterThan(0)
    expect(goodrx[0]).toHaveAttribute('href', expect.stringContaining('goodrx.com'))
    const costPlus = within(panel).getAllByRole('link', { name: /Cost\+/i })
    expect(costPlus.length).toBeGreaterThan(0)
    costPlus.forEach((link) => {
      expect(link).toHaveAttribute('href', expect.stringMatching(/costplusdrugs\.com\/medications\/.+\/$/))
      expect(link).not.toHaveAttribute('href', 'https://www.costplusdrugs.com/medications/')
    })
    // coverage panels carry their own source link
    expect(within(panel).getAllByRole('link', { name: /source/i }).length).toBeGreaterThan(0)
  })

  it('surfaces the source-confidence state inline (verified vs partial)', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(/Verified against/i)).toBeInTheDocument()
    await switchGuide(user, /Maryland/i, /Menopause HT/i)
    expect(screen.getByText(/Partially verified/i)).toBeInTheDocument()
  })

  // Since 2026-10-21 every state has every topic, so the "jump to an available condition" /
  // "(not yet)" path isn't reachable from the picker; this checks the condition is kept instead.
  it('switching state keeps the current condition when the new state has it', async () => {
    const user = userEvent.setup()
    render(<App />)
    const stateSelect = screen.getByLabelText(/^State$/) as HTMLSelectElement
    await user.selectOptions(stateSelect, 'TX')
    await waitFor(() => expect(selectedText(/^State$/)).toMatch(/Texas/))
    expect(selectedText(/^Condition$/)).toMatch(/Inhalers/)
    expect(screen.queryByText(/Not covered yet/)).not.toBeInTheDocument()
  })

  it('keeps the plan and class in the URL and restores them from a shared link', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await user.click(screen.getByRole('tab', { name: /Daily combo controller/ }))
    await waitFor(() => expect(window.location.search).toMatch(/class=icslaba/))
    expect(window.location.search).toMatch(/guide=ma-inhalers/)
    const link = window.location.search
    unmount()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/' + link)
    render(<App />)
    expect(screen.getByRole('tab', { name: /Daily combo controller/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('remembers the last plan on this device when there is no link', async () => {
    const { unmount } = render(<App />)
    const plan = screen.getByLabelText(/select insurance plan/i) as HTMLSelectElement
    const second = plan.options[1]!.value
    fireEvent.change(plan, { target: { value: second } })
    await waitFor(() => expect(window.localStorage.getItem('fprx:last-pick')).toContain(second))
    unmount()
    window.history.replaceState({}, '', '/')
    render(<App />)
    await waitFor(() => expect((screen.getByLabelText(/select insurance plan/i) as HTMLSelectElement).value).toBe(second))
  })

  it('builds a prescriber PA request with a reviewer checklist, without storing input', async () => {
    const user = userEvent.setup()
    render(<App />)
    const card = document.querySelector('.rx-option-card.is-barrier') as HTMLElement
    await user.click(within(card).getByRole('button', { name: /request pa/i }))
    // The total depends on whether the plan's own criteria exist for this drug (4 or 5 items).
    const total = Number(card.querySelector('.pa-builder__score b')?.textContent?.match(/of (\d+)/)?.[1])
    expect(within(card).getByText(new RegExp(`0 of ${total}`))).toBeInTheDocument()
    await user.type(within(card).getByLabelText(/Diagnosis/), 'J45.40 moderate persistent asthma')
    expect(within(card).getByText(new RegExp(`1 of ${total}`))).toBeInTheDocument()
    expect(within(card).getByText(/42 U\.S\.C/)).toBeInTheDocument()
    expect(card.querySelector('.pa-builder__letter')?.textContent).toMatch(/DIAGNOSIS: J45\.40/)
    expect(window.localStorage.getItem('fprx:last-pick') ?? '').not.toMatch(/J45/)
  })

  // Codex review on PR 19: the aka (e.g. "statewide PDL binds every Medicaid MCO") was only a
  // tooltip after the picker compaction, invisible on touch devices.
  it('shows the plan alias / coverage scope as visible text', async () => {
    window.history.replaceState({}, '', '/?guide=pa-ssris&plan=pa-medicaid')
    render(<App />)
    expect(await screen.findByText(/every Pennsylvania Medicaid managed care plan statewide/)).toBeVisible()
  })

  it('says nothing is covered instead of recommending a drug the plan does not list', async () => {
    window.history.replaceState({}, '', '/?guide=ma-weight&plan=tufts&class=aom-glp1')
    render(<App />)
    expect(await screen.findByText("NOT ON THE PLAN'S DRUG LIST")).toBeInTheDocument()
    expect(screen.queryByText('FIRST-PASS RECOMMENDED')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '4. Coverage' })).toBeInTheDocument()
  })

  it('PA request shows the plan criteria, ICD-10 suggestions, and where to send it (MGB ICS)', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?guide=ma-inhalers&plan=mgb&class=ics')
    render(<App />)
    const card = (await screen.findByRole('heading', { level: 5, name: /Fluticasone propionate HFA/ })).closest('.rx-option-card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: /request pa/i }))
    expect(within(card).getByText(/approves when ANY ONE/)).toBeInTheDocument()
    expect(card.querySelector('.pa-criteria')).toHaveTextContent(/BOTH Arnuity Ellipta and QVAR RediHaler/)
    expect(card.querySelector('.pa-builder__send-line')).toHaveTextContent('fax 844-403-1029')
    expect(card.querySelector('datalist option[value^="J45.40"]')).not.toBeNull()
    // Provenance (Codex review, PR 21): routing numbers, criteria, and ICD list each link a source.
    expect(card.querySelector('.pa-builder__send .pa-builder__source a')?.getAttribute('href')).toMatch(/massgeneralbrighamhealthplan\.org/)
    expect(card.querySelector('.pa-criteria .pa-builder__source a')).not.toBeNull()
    expect(within(card).getByRole('link', { name: /CMS code file/ })).toHaveAttribute('href', expect.stringMatching(/cms\.gov/))
    expect(card.querySelector('.pa-builder__letter')?.textContent).toMatch(/Send to: fax 844-403-1029.*\(source: https:/)
    await user.selectOptions(within(card).getByLabelText(/Criterion 2: met or not/), 'met')
    await user.type(within(card).getByLabelText(/Chart evidence for criterion 2/), 'QVAR 3/2025 and Arnuity 1/2026, poor control')
    expect(within(card).getByText(/1 of 5/)).toBeInTheDocument()
    expect(card.querySelector('.pa-builder__letter')?.textContent).toMatch(/2\. Asthma diagnosis.*: MET — QVAR 3\/2025/)
  })

  // Regression: under StrictMode the init effect ran twice and re-read a URL the sync effect had
  // already overwritten with the default plan, so a shared default-guide link lost its plan.
  it('keeps a shared link\'s plan and class under StrictMode', async () => {
    window.history.replaceState({}, '', '/?guide=ma-inhalers&plan=mgb&class=ics')
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    await waitFor(() => expect(window.location.search).toBe('?guide=ma-inhalers&plan=mgb&class=ics'))
    expect((screen.getByLabelText(/select insurance plan/i) as HTMLSelectElement).value).toBe('mgb')
  })

  it('offers a PA request on the recommended drug itself when it needs plan approval', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/?guide=ma-lipids&plan=masshealth&class=pcsk9')
    render(<App />)
    const hero = (await screen.findByRole('heading', { level: 3, name: 'Repatha' })).closest('.recommendation-hero') as HTMLElement
    await user.click(within(hero).getByRole('button', { name: /request pa/i }))
    expect(hero.querySelector('.pa-builder__letter')?.textContent).toMatch(/REQUEST: prior authorization for Repatha/)
  })
})
