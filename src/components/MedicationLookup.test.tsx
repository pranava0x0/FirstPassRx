import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MedicationLookup, PlanComparison } from './MedicationLookup'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('can retry a failed catalog, browse without typing, and compare the selected real listing', async () => {
  const drug = 'Albuterol HFA inhaler (generic)'
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ [drug]: ['ma-inhalers/saba'] }) }),
  )
  const user = userEvent.setup()
  const compare = vi.fn()
  render(<MedicationLookup compare={compare} />)
  await user.click(await screen.findByRole('button', { name: 'Retry' }))
  await user.click(await screen.findByRole('button', { name: 'Browse medications' }))
  await user.click(screen.getByRole('option', { name: drug }))
  await user.selectOptions(await screen.findByLabelText('Insurance plan'), 'masshealth')
  expect(await screen.findByText('PA required', { selector: 'strong' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Compare plans' }))
  expect(compare).toHaveBeenCalledWith({
    drug,
    classId: 'saba',
    guideId: 'ma-inhalers',
    payerId: 'masshealth',
  })
})

it('matches one product under each plan\'s own wording and marks a missing listing unknown', async () => {
  const user = userEvent.setup()
  const { unmount } = render(
    <PlanComparison
      start={{ drug: 'Albuterol HFA inhaler (generic)', guideId: 'ma-inhalers', classId: 'saba', payerId: 'masshealth' }}
      back={() => {}}
    />,
  )
  expect(await screen.findByLabelText('First plan')).toHaveValue('masshealth')
  await user.selectOptions(await screen.findByLabelText('Second plan'), 'mgb')
  let regions = screen.getByRole('region', { name: 'Plan comparison' }).querySelectorAll('section')
  expect(within(regions[0]!).getByText('PA required', { selector: 'strong' })).toBeVisible()
  // MGB prints the same generic as "Albuterol sulfate HFA · 90 mcg"
  expect(within(regions[1]!).getByText(/Listed as: Albuterol sulfate HFA/)).toBeVisible()
  unmount()

  render(
    <PlanComparison
      start={{ drug: 'ProAir Digihaler', guideId: 'ma-inhalers', classId: 'saba', payerId: 'masshealth' }}
      back={() => {}}
    />,
  )
  await user.selectOptions(await screen.findByLabelText('Second plan'), 'mgb')
  regions = screen.getByRole('region', { name: 'Plan comparison' }).querySelectorAll('section')
  expect(within(regions[1]!).getByText(/Not listed by this plan.*unknown/)).toBeVisible()
})
