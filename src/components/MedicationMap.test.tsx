import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import catalog from '../data/generated/medications.json'
import { MedicationMap } from './MedicationMap'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

it('deep-links ?med=dovato to every state and opens Virginia with Aetna, cash price and copay card', async () => {
  window.history.replaceState({}, '', '/?med=dovato&state=VA')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => catalog }))
  render(<MedicationMap />)
  const panel = (await screen.findByRole('heading', { name: 'Virginia (VA)', level: 3 })).closest('section')!
  expect(window.location.search).toContain('med=Dovato')
  expect(within(panel).getByText(/Covered, no PA on 9 of 9 · not the preferred pick/)).toBeVisible()
  expect(within(panel).getByText('Aetna (commercial, Advanced Control Plan)')).toBeVisible()
  expect(within(panel).getByRole('link', { name: /GoodRx: \$3,223 for 30 tablets/ })).toHaveAttribute('href', 'https://www.goodrx.com/dovato')
  expect(within(panel).getByRole('link', { name: /ViiVConnect Copay Program/ })).toBeVisible()
  // Virginia is spelled out on the tile's accessible name, not a bare code.
  expect(screen.getByRole('button', { name: /^Virginia: Covered, no PA/ })).toBeVisible()
  // Not the preferred pick in Virginia: no celebration.
  expect(document.querySelector('.confetti')).toBeNull()
})

it('says so when a link names no single product', async () => {
  window.history.replaceState({}, '', '/?med=zzzz-not-a-drug')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => catalog }))
  render(<MedicationMap />)
  expect(await screen.findByText(/No single medication matches “zzzz-not-a-drug”/)).toBeVisible()
})

it('bursts confetti when a state prefers the drug on every plan', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => catalog }))
  window.history.replaceState({}, '', '/?med=biktarvy')
  const user = userEvent.setup()
  render(<MedicationMap />)
  const starred = (await screen.findAllByRole('button', { name: /★/ }))[0]!
  await user.click(starred)
  expect(document.querySelectorAll('.confetti i').length).toBe(18)
})
