import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

/** The preferred-agent name is the only level-2 heading in the result panel. */
function agentHeading() {
  return within(screen.getByRole('tabpanel')).getByRole('heading', { level: 2 })
}

describe('FirstPassRx app', () => {
  it('renders the masthead and the persistent reference-only disclaimer', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FirstPassRx')
    expect(screen.getByRole('note', { name: /data disclaimer/i })).toBeInTheDocument()
  })

  it('defaults to MassHealth SABA and shows the verified BOGL brand-required warning', () => {
    render(<App />)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')
    expect(screen.getByText(/Ask for the brand name/i)).toBeInTheDocument()
    // Patient/Doctor guidance lives in the appendix; the dynamic generic name is interpolated.
    const doctorLi = screen.getByText(/Doctor:/i).closest('li')
    expect(doctorLi).toHaveTextContent(/write Ventolin HFA on the prescription, not generic albuterol/i)
    expect(screen.getByText(/Patient:/i)).toBeInTheDocument()

    expect(screen.queryByText(/generic OK/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Q4-6H PRN/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/90 micrograms per puff/i)).not.toBeInTheDocument()
  })

  it('copies the (editable) brand sig for a BOGL cell', async () => {
    render(<App />)
    fireEvent.click(screen.getByText(/Prescription text for clinician/i))
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Ventolin HFA 90 micrograms - 2 puffs every 4 to 6 hours as needed',
      ),
    )
  })

  it('lets the prescriber edit the sig before copying', async () => {
    render(<App />)
    fireEvent.click(screen.getByText(/Prescription text for clinician/i))
    const field = screen.getByLabelText(/editable prescription text/i)
    fireEvent.change(field, {
      target: { value: 'Ventolin HFA 90 micrograms - 1 puff four times daily as needed' },
    })
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Ventolin HFA 90 micrograms - 1 puff four times daily as needed',
      ),
    )
  })

  it('switches to a non-BOGL plan and copies the generic sig', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/select insurance plan/i), {
      target: { value: 'bcbsma' },
    })
    expect(screen.queryByText(/Use brand name/i)).not.toBeInTheDocument()
    expect(screen.getByText(/a generic is fine/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Prescription text for clinician/i))
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Albuterol sulfate HFA 90 micrograms - 2 puffs every 4 to 6 hours as needed',
      ),
    )
  })

  it('lists reject drugs with reasons and disables the appeal + biologics actions', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(/Levalbuterol \(Xopenex HFA\)/)).toBeInTheDocument()
    expect(screen.getAllByText(/prior authorization needed/i).length).toBeGreaterThan(0)
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
    const options = within(panel).getByRole('region', { name: /what to prescribe/i })
    expect(within(options).getByText(/Recommended/)).toBeInTheDocument()
    expect(within(options).getByText(/Advair Diskus/)).toBeInTheDocument()
    expect(within(options).getByText(/Breo Ellipta/)).toBeInTheDocument()
    expect(within(options).getByText('Cost in plan')).toBeInTheDocument()
    expect(within(options).getByText('Cash price')).toBeInTheDocument()
    // rejects sit in their own ledger (the step text also names AirDuo)
    const rejects = within(panel).getByRole('region', {
      name: /may need extra insurance approval/i,
    })
    expect(within(rejects).getByText(/AirDuo RespiClick/)).toBeInTheDocument()
  })

  it('opens a plain-language glossary definition on tap', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText(/Why this matters/i))
    await user.click(screen.getByRole('button', { name: /brand-over-generic rule/i }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/brand/i)
  })

  it('toggles to the Maryland menopause guide: new region, plans, classes, and agent', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Default guide is MA inhalers.
    expect(screen.getByText(/Massachusetts inhaler guide/i)).toBeInTheDocument()
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')

    await user.click(screen.getByRole('button', { name: /Menopause HT/i }))

    // Masthead, class legend, plan list, and the result all swap to the menopause guide.
    expect(screen.getByText(/Maryland menopause/i)).toBeInTheDocument()
    expect(screen.getByText('Hormone type', { selector: 'legend' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Maryland Medicaid/i })).toBeInTheDocument()
    expect(agentHeading()).toHaveTextContent(/Estradiol/i)
    // Inhaler-specific plans are gone.
    expect(screen.queryByRole('option', { name: 'MassHealth' })).not.toBeInTheDocument()
  })

  it('cites the source inline and shows in-plan + cash cost in the options table', () => {
    render(<App />)
    const panel = screen.getByRole('tabpanel')
    // the answer cites its source inline (provenance line links to the formulary; the appendix
    // citation links to the same source, so there's more than one)
    const cite = within(panel).getAllByRole('link', { name: /MassHealth Drug List/i })
    expect(cite[0]).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
    // cost shows as columns: in-plan and cash
    expect(within(panel).getByText('Cost in plan')).toBeInTheDocument()
    expect(within(panel).getByText('Cash price')).toBeInTheDocument()
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
    expect(screen.getByText(/Source confidence:/i).closest('p')).toHaveTextContent(/Verified/)
    await user.click(screen.getByRole('button', { name: /Menopause HT/i }))
    expect(screen.getByText(/Source confidence:/i).closest('p')).toHaveTextContent(
      /Partial — confirm in source/,
    )
  })
})
