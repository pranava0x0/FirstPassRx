# UAT — interaction cost

How many taps and swipes a prescriber needs to reach each key fact, cold from `/`, per device.
Harness: [scripts/uat-interactions.js](scripts/uat-interactions.js) (runs inside the page, so no
Playwright dependency). Results: [uat/interaction_costs.json](uat/interaction_costs.json).
Budgets: [uat/interaction_budgets.json](uat/interaction_budgets.json).

## How to run

With `npm run dev` open in a browser, run in the page console (or the in-app browser's JS tool):

```js
eval((await import('/scripts/uat-interactions.js?raw')).default); await runUatAll()
```

Each task runs in its own freshly loaded, same-origin iframe at each device size, with
`localStorage` cleared first (the app remembers the last plan). Compare totals to the budgets
and update `uat/interaction_costs.json`.

## Tasks

| id | question |
|---|---|
| default_preferred | Preferred drug for the default plan + class |
| other_state_preferred | Preferred drug for the 3rd NY diabetes plan |
| second_class | Preferred drug for the 2nd class tab |
| pa_barrier | Which drugs need PA on this plan + class |
| pa_draft | Open a PA request for the first blocked drug |
| cash_price | Cash price of the preferred drug |

## Log

- **2026-10-21** — Replaced the state/topic button grids with two side-by-side native selects,
  shrank section headers, added a "Needs plan approval" line in the result header. Mobile:
  preferred drug 1→0 swipes, 2nd class 3→1, PA list 3→1, PA draft 5→4. Switching state+topic+plan
  went 5→6 (a select pick counts 2 taps), but the picker no longer grows with the state count
  (10 states was already a full phone screen of buttons), and a remembered last pick makes the
  common repeat visit 0.
- **2026-10-21 (evening)** — Re-ran after the picker grew to 12 conditions and every state got all
  12 topics: every task identical to the morning numbers (mobile: preferred 0, PA list 1, PA draft
  4, switch state+condition+plan 6). The select-based picker absorbed 3× the guides with no cost.
