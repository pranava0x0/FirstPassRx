import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  await user.click(screen.getByRole('tab', { name: stateName }))
  await waitFor(() => expect(screen.getByRole('tab', { name: topicName })).toBeEnabled())
  await user.click(screen.getByRole('tab', { name: topicName }))
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: topicName })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/^Loading$/)).not.toBeInTheDocument()
  })
}

describe('FirstPassRx app', () => {
  beforeEach(() => {
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
    expect(screen.getByText(/Levalbuterol \(Xopenex HFA\)/)).toBeInTheDocument()
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

    const rejectCard = screen.getByText(/Levalbuterol \(Xopenex HFA\)/).closest('.rx-option-card')
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
    expect(screen.getByRole('tab', { name: /Inhalers/i })).toHaveAttribute('aria-selected', 'true')
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')

    await switchGuide(user, /Maryland/i, /Menopause HT/i)

    // Masthead, class legend, plan list, and the result all swap to the menopause guide.
    expect(screen.getByRole('tab', { name: /Menopause HT/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Prescription type/i, { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Maryland Medicaid/i })).toBeInTheDocument()
    expect(agentHeading()).toHaveTextContent(/Estradiol/i)
    // Inhaler-specific plans are gone.
    expect(screen.queryByRole('option', { name: 'MassHealth' })).not.toBeInTheDocument()
  })

  it('loads a non-default guide directly from the URL', async () => {
    window.history.replaceState({}, '', '/?guide=va-diabetes')
    render(<App />)
    expect(await screen.findByRole('option', { name: /Virginia Medicaid/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Virginia/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Diabetes$/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the not-covered state for a state/topic pair with no guide', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /Virginia/i }))
    // VA only has a diabetes guide today; inhalers stays selected from the MA default.
    expect(screen.getByText(/Not covered yet/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/select insurance plan/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Diabetes$/i }))
    expect(await screen.findByRole('option', { name: /Virginia Medicaid/i })).toBeInTheDocument()
    expect(screen.queryByText(/Not covered yet/i)).not.toBeInTheDocument()
  })

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
})
