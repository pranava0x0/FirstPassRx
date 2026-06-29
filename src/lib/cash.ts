// Cash-price lookups for a drug. Paying cash with a discount can beat an insurance copay on cheap
// generics — and it skips prior authorization. We link to live pricing, never a baked-in number
// (prices change daily; CLAUDE.md: don't manufacture certainty). GoodRx aggregates pharmacy coupons;
// Cost Plus Drugs (Mark Cuban) sells generics at cost + a flat markup.

function drugSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parenthesized details like (generic)
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, '') // trim hyphens from the ends
}

export function goodRxUrl(name: string): string {
  return `https://www.goodrx.com/${drugSlug(name)}`
}

export function costPlusUrl(_name: string): string {
  // Cost Plus Drugs uses a curated catalog and does not support search query parameters;
  // linking to their search directory is the most reliable fallback.
  return 'https://costplusdrugs.com/medications/'
}
