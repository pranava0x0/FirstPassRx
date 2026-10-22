// Write src/data/formulary.json only if the app's full validate() accepts it. validate() runs when
// src/lib/formulary.test.ts loads; the "-t __validate_only__" filter runs no test bodies, so a
// newly added guide not yet in the test's order list does not fail the check. On failure the
// original file is restored and the process exits non-zero, so a malformed import never lands.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

export const FORMULARY = 'src/data/formulary.json'

export function writeValidatedFormulary(data) {
  const original = readFileSync(FORMULARY, 'utf8')
  writeFileSync(FORMULARY, JSON.stringify(data, null, 2) + '\n')
  const check = spawnSync('npx', ['vitest', 'run', 'src/lib/formulary.test.ts', '-t', '__validate_only__', '--passWithNoTests'], { encoding: 'utf8' })
  if (check.status !== 0) {
    writeFileSync(FORMULARY, original)
    console.error((check.stdout + check.stderr).split('\n').filter((l) => / - guide |Invalid formulary/.test(l)).slice(0, 30).join('\n'))
    console.error(`validation failed: ${FORMULARY} left unchanged`)
    process.exit(1)
  }
  console.log(`wrote ${FORMULARY} (validated)`)
}
