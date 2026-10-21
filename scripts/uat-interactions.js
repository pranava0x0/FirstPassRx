/*
 * Interaction-cost UAT: how many taps and swipes a prescriber needs to reach a key fact,
 * starting cold at `/` on each device. Same counting rules as the community-benefits
 * harness (tools/interaction_cost.py there):
 *
 *   taps    every click/tap, including opening a <details> or picking a <select> option
 *           (a native select pick = 2 taps: open + choose)
 *   swipes  vertical scrolls needed to bring the target fully on screen, in units of
 *           0.75 × viewport height, measured from the current scroll position
 *
 * No Playwright dependency: paste this file into the page (browser devtools, or the in-app
 * browser's javascript tool) at each viewport, then call `await runUat()`. It reloads state
 * between tasks by navigating with history.replaceState + a fresh render is NOT possible from
 * inside the page, so each task starts from the default guide via the UI itself.
 *
 * Results go in uat/interaction_costs.json; budgets in uat/interaction_budgets.json.
 */
/* eslint-disable */
;(function () {
  const SWIPE = 0.75
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  async function waitFor(fn, ms = 4000) {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const v = fn()
      if (v) return v
      await sleep(50)
    }
    throw new Error('timeout waiting for ' + fn)
  }

  function makeCounter() {
    const c = { taps: 0, swipes: 0, path: [] }
    c.reach = async (el, label) => {
      const vh = window.innerHeight
      const box = el.getBoundingClientRect()
      // A tall target (an opened panel) only needs its first lines on screen to be "seen".
      const r = { top: box.top, bottom: Math.min(box.bottom, box.top + 160) }
      let need = 0
      if (r.bottom > vh) need = Math.ceil((r.bottom - vh) / (vh * SWIPE))
      else if (r.top < 0) need = Math.ceil(-r.top / (vh * SWIPE))
      if (need) {
        c.swipes += need
        c.path.push(`swipe x${need}`)
        window.scrollBy(0, r.bottom > vh ? r.bottom - vh + 8 : r.top - 8)
        await sleep(30)
      }
      if (label) c.path.push(label)
    }
    c.tap = async (el, label) => {
      await c.reach(el)
      c.taps += 1
      c.path.push('tap: ' + label)
      el.click()
      await sleep(120)
    }
    c.select = async (el, value, label) => {
      await c.reach(el)
      c.taps += 2
      c.path.push('select: ' + label + ' (2 taps)')
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(250)
    }
    c.see = async (el, label) => {
      await c.reach(el, 'see: ' + label)
    }
    return c
  }

  const $ = (s) => document.querySelector(s)
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent))

  // Reset to the default guide + top of page, as a cold arrival would see it.
  async function cold() {
    if (location.search) {
      history.replaceState({}, '', location.pathname)
    }
    try { localStorage.clear() } catch {}
    window.__fprxReset && window.__fprxReset()
    window.scrollTo(0, 0)
    await sleep(300)
  }

  // Selecting state/topic/plan works with either the legacy button grid or the new selects.
  async function pickState(c, code, name) {
    const sel = $('#state-select')
    if (sel) return c.select(sel, code, name)
    return c.tap(byText('[role=tab]', new RegExp('^' + name + '$')), name)
  }
  async function pickTopic(c, id, label) {
    const sel = $('#topic-select')
    if (sel) return c.select(sel, id, label)
    return c.tap(byText('[role=tab]', new RegExp('^' + label + '$')), label)
  }
  async function pickPlan(c, index) {
    const sel = await waitFor(() => $('#plan-select'))
    await c.select(sel, sel.options[index].value, 'plan #' + index)
  }

  const TASKS = {
    default_preferred: {
      q: 'See the preferred drug for the default plan + class.',
      run: async (c) => c.see(await waitFor(() => $('.recommendation-hero__name')), 'preferred drug'),
    },
    other_state_preferred: {
      q: 'Preferred SGLT2/GLP-1 for the 3rd NY diabetes plan.',
      run: async (c) => {
        await pickState(c, 'NY', 'New York')
        await pickTopic(c, 'diabetes', 'Diabetes')
        await pickPlan(c, 2)
        await c.see(await waitFor(() => $('.recommendation-hero__name')), 'preferred drug')
      },
    },
    second_class: {
      q: 'Preferred daily controller (2nd class) on the default plan.',
      run: async (c) => {
        const tabs = await waitFor(() => document.querySelectorAll('#sec-class-title ~ .seg [role=tab]:not([aria-disabled])'))
        await c.tap(tabs[1], 'class #2')
        await c.see(await waitFor(() => $('.recommendation-hero__name')), 'preferred drug')
      },
    },
    pa_barrier: {
      q: 'See which drugs need prior auth on the default plan + class.',
      // The hero's "Needs PA" line names them without scrolling; otherwise scroll to the cards.
      run: async (c) =>
        c.see(await waitFor(() => $('.pa-summary') || $('.rx-option-card.is-barrier')), 'PA-blocked drugs'),
    },
    pa_draft: {
      q: 'Open a PA request/letter draft for the first blocked drug.',
      run: async (c) => {
        const card = await waitFor(() => $('.rx-option-card.is-barrier'))
        const btn = card.querySelector('.pa-open-btn, .appeal-btn')
        await c.tap(btn, 'open PA draft')
        await c.see(await waitFor(() => card.querySelector('textarea, .pa-builder')), 'draft')
      },
    },
    cash_price: {
      q: 'See the cash price of the preferred drug.',
      run: async (c) => c.see(await waitFor(() => $('.recommendation-hero .price-boxes')), 'cash price'),
    },
  }

  window.runUat = async function runUat(only) {
    const out = { viewport: { w: innerWidth, h: innerHeight }, swipe_fraction: SWIPE, tasks: {} }
    for (const [id, t] of Object.entries(TASKS)) {
      if (only && id !== only) continue
      await cold()
      const c = makeCounter()
      try {
        await t.run(c)
        out.tasks[id] = { question: t.q, taps: c.taps, swipes: c.swipes, total: c.taps + c.swipes, path: c.path }
      } catch (e) {
        out.tasks[id] = { question: t.q, error: String(e), path: c.path }
      }
    }
    return out
  }
})()
