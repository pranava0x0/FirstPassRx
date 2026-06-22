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
    expect(screen.getByText(/BOGL · brand req/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Brand required/i).length).toBeGreaterThan(0)
  })

  it('copies the (editable) brand sig for a BOGL cell', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Ventolin HFA 90 mcg - 2 puffs Q4-6H PRN'),
    )
  })

  it('lets the prescriber edit the sig before copying', async () => {
    render(<App />)
    const field = screen.getByLabelText(/editable prescription sig/i)
    fireEvent.change(field, { target: { value: 'Ventolin HFA 90 mcg - 1 puff QID PRN' } })
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Ventolin HFA 90 mcg - 1 puff QID PRN'),
    )
  })

  it('switches to a non-BOGL plan and copies the generic sig', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText(/select insurance plan/i), {
      target: { value: 'bcbsma' },
    })
    expect(screen.queryByText(/BOGL · brand req/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /copy sig/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Albuterol sulfate HFA 90 mcg - 2 puffs Q4-6H PRN'),
    )
  })

  it('lists reject drugs with reasons and disables the appeal + biologics actions', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = screen.getByRole('tabpanel')
    await user.click(within(panel).getByText(/Drugs that may reject/i))
    expect(screen.getByText(/Levalbuterol \(Xopenex HFA\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /automate appeal/i })).toBeDisabled()
    const biologics = screen.getByRole('tab', { name: /biologics/i })
    expect(biologics).toHaveAttribute('aria-disabled', 'true')
    await user.click(biologics)
    expect(agentHeading()).toHaveTextContent('Ventolin HFA')
  })

  it('changes the preferred agent when the class tab changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /ICS\/LABA/ }))
    expect(agentHeading()).toHaveTextContent('Budesonide/formoterol')
  })

  it('shows source citations with working links on every result', () => {
    render(<App />)
    const panel = screen.getByRole('tabpanel')
    fireEvent.click(within(panel).getByText(/Sources and verification/i))
    const sources = within(panel).getByRole('region', { name: /sources/i })
    const links = within(sources).getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//))
  })

  it('searches by drug name and jumps to the matching cell', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('searchbox', { name: /search a drug/i }), 'symbicort')
    // Symbicort is preferred for several plans — click the first match.
    const results = await screen.findAllByRole('button', { name: /Preferred .*Symbicort/i })
    await user.click(results[0]!)
    expect(agentHeading()).toHaveTextContent('Budesonide/formoterol')
  })

  it('shows a coverage ladder: first-pass pick + also-covered alternatives + rejects', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(/How this works/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /ICS\/LABA/ }))
    const panel = screen.getByRole('tabpanel')
    // first-pass pick
    expect(within(panel).getByText(/First choice/i)).toBeInTheDocument()
    // also-covered alternatives (verified MassHealth no-PA combos)
    await user.click(within(panel).getByText(/Other covered choices/i))
    const alts = within(panel).getByRole('region', { name: /also covered/i })
    expect(within(alts).getByText(/Advair Diskus/)).toBeInTheDocument()
    expect(within(alts).getByText(/Breo Ellipta/)).toBeInTheDocument()
    // rejects still present (scope to the reject ledger — the step text also names AirDuo)
    await user.click(within(panel).getByText(/Drugs that may reject/i))
    const rejects = within(panel).getByRole('region', { name: /will reject/i })
    expect(within(rejects).getByText(/AirDuo RespiClick/)).toBeInTheDocument()
  })

  it('opens a plain-language glossary definition on tap', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'BOGL' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/brand/i)
  })
})
