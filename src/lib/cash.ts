// Cash-price lookups for a drug. Paying cash with a discount can beat an insurance copay on cheap
// generics — and it skips prior authorization. We link to live pricing, never a baked-in number
// (prices change daily; CLAUDE.md: don't manufacture certainty). GoodRx aggregates pharmacy coupons;
// Cost Plus Drugs (Mark Cuban) sells generics at cost + a flat markup.

function cashQuery(name: string): string {
  return name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
}

export function goodRxUrl(name: string): string {
  return `https://www.goodrx.com/search?query=${encodeURIComponent(cashQuery(name))}`
}

export function costPlusUrl(name: string): string {
  return `https://costplusdrugs.com/medications/?search=${encodeURIComponent(cashQuery(name))}`
}
