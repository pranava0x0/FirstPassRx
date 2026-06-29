import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

/** The preferred-agent name is the level-3 heading in the recommendation hero box. */
function agentHeading() {
  return within(screen.getByRole('tabpanel')).getByRole('heading', { level: 3 })
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

  it('lists reject drugs with reasons and disables the appeal + biologics actions', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(/Levalbuterol \(Xopenex HFA\)/)).toBeInTheDocument()
    expect(screen.getAllByText(/PA Required/i).length).toBeGreaterThan(0)
    const biologics = screen.getByRole('tab', { name: /biologics/i })
    expect(biologics).toHaveAttribute('aria-disabled', 'true')
    await user.click(biologics)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')
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
    expect(within(options).getAllByText(/Cash \/ Details/i).length).toBeGreaterThan(0)
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
    expect(screen.getByRole('button', { name: /Inhalers/i })).toHaveAttribute('aria-pressed', 'true')
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')

    await user.click(screen.getByRole('button', { name: /Menopause HT/i }))

    // Masthead, class legend, plan list, and the result all swap to the menopause guide.
    expect(screen.getByRole('button', { name: /Menopause HT/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Prescription type/i, { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Maryland Medicaid/i })).toBeInTheDocument()
    expect(agentHeading()).toHaveTextContent(/Estradiol/i)
    // Inhaler-specific plans are gone.
    expect(screen.queryByRole('option', { name: 'MassHealth' })).not.toBeInTheDocument()
  })

  it('names the exact benefit product instead of implying carrier-wide coverage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Menopause HT/i }))
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
    expect(within(panel).getAllByText(/Cash \/ Details/i).length).toBeGreaterThan(0)
    // cash links per option — GoodRx and Cost Plus Drugs
    const goodrx = within(panel).getAllByRole('link', { name: /GoodRx/i })
    expect(goodrx.length).toBeGreaterThan(0)
    expect(goodrx[0]).toHaveAttribute('href', expect.stringContaining('goodrx.com'))
    const costPlus = within(panel).getAllByRole('link', { name: /Cost\+/i })
    expect(costPlus.length).toBeGreaterThan(0)
    expect(costPlus[0]).toHaveAttribute('href', expect.stringContaining('costplusdrugs.com'))
    // coverage panels carry their own source link
    expect(within(panel).getAllByRole('link', { name: /source/i }).length).toBeGreaterThan(0)
  })

  it('surfaces the source-confidence state inline (verified vs partial)', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(/Verified against/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Menopause HT/i }))
    expect(screen.getByText(/Partially verified/i)).toBeInTheDocument()
  })
})
