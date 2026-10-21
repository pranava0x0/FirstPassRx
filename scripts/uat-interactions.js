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
 * No Playwright dependency. With `npm run dev` open, run in the page console (or the in-app
 * browser's JS tool):
 *
 *   eval((await import('/scripts/uat-interactions.js?raw')).default); await runUatAll()
 *
 * Every task runs in its own freshly loaded iframe at each device size, with storage cleared.
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

  /** Run ONE task in this (freshly loaded) page. Each task needs its own cold page load. */
  window.runUatTask = async function runUatTask(id) {
    const t = TASKS[id]
    if (!t) throw new Error('unknown task ' + id)
    const c = makeCounter()
    try {
      await t.run(c)
      return { question: t.q, taps: c.taps, swipes: c.swipes, total: c.taps + c.swipes, path: c.path }
    } catch (e) {
      return { question: t.q, error: String(e), path: c.path }
    }
  }

  /**
   * From the top-level page: run every task at each device size, each in a brand-new
   * same-origin iframe with storage cleared first, so no task inherits another's picks
   * (the app remembers the last plan in localStorage and carries it in the URL).
   */
  window.runUatAll = async function runUatAll(
    devices = { mobile: [375, 812], tablet: [820, 1180], desktop: [1366, 900] },
  ) {
    const src = (await import('/scripts/uat-interactions.js?raw')).default
    const out = {}
    for (const [device, [w, h]] of Object.entries(devices)) {
      out[device] = {}
      for (const id of Object.keys(TASKS)) {
        try { localStorage.clear() } catch {}
        const f = document.createElement('iframe')
        f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:99999;background:#fff`
        f.src = '/'
        document.body.appendChild(f)
        await new Promise((r) => (f.onload = r))
        await sleep(900)
        f.contentWindow.eval(src)
        out[device][id] = await f.contentWindow.runUatTask(id)
        f.remove()
      }
    }
    try { localStorage.clear() } catch {}
    return out
  }
})()
