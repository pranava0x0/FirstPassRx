#!/usr/bin/env node
// A drug listed in two criteria sets for the same guide/class (an extraction agent put it under the
// class's general non-preferred rule AND under its own drug-specific criteria) makes
// apply-pa-criteria.mjs refuse the file. Keep it only in the most specific set (fewest drugs), and
// report each move so the choice is reviewable.
//
//   node scripts/dedupe-pa-criteria.mjs <file.json> [...]
import { readFileSync, writeFileSync } from 'node:fs'

for (const file of process.argv.slice(2)) {
  const f = JSON.parse(readFileSync(file, 'utf8'))
  const owner = new Map()
  for (const set of f.sets ?? [])
    for (const drug of set.drugs ?? []) {
      const key = `${set.guideId}|${set.classId}|${drug}`
      const prev = owner.get(key)
      if (!prev || set.drugs.length < prev.drugs.length) owner.set(key, set)
    }
  let moved = 0
  for (const set of f.sets ?? []) {
    const keep = set.drugs.filter((d) => owner.get(`${set.guideId}|${set.classId}|${d}`) === set)
    for (const d of set.drugs.filter((x) => !keep.includes(x))) console.log(`  ${set.guideId}/${set.classId}: "${d}" kept only in its more specific set`)
    moved += set.drugs.length - keep.length
    set.drugs = keep
  }
  f.sets = f.sets.filter((s) => s.drugs.length)
  writeFileSync(file, JSON.stringify(f, null, 2))
  console.log(`${file}: ${moved} duplicate listing(s) removed`)
}
