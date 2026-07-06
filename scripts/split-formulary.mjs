import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(root, 'src/data/formulary.json')
const outputDir = path.join(root, 'src/data/generated')
const guidesDir = path.join(outputDir, 'guides')
const checkOnly = process.argv.includes('--check')

const formulary = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const outputs = new Map()
outputs.set(
  path.join(outputDir, 'index.json'),
  `${JSON.stringify(
    {
      meta: formulary.meta,
      guides: formulary.guides.map(({ id, label, stateCode, region, topicId, topic }) => ({
        id,
        label,
        stateCode,
        region,
        topicId,
        topic,
      })),
    },
    null,
    2,
  )}\n`,
)
for (const guide of formulary.guides) {
  outputs.set(path.join(guidesDir, `${guide.id}.json`), `${JSON.stringify(guide, null, 2)}\n`)
}

const expectedPaths = new Set(outputs.keys())
const existingGuidePaths = fs.existsSync(guidesDir)
  ? fs.readdirSync(guidesDir).map((name) => path.join(guidesDir, name))
  : []
const stalePaths = existingGuidePaths.filter((filePath) => !expectedPaths.has(filePath))
const changedPaths = [...outputs].filter(
  ([filePath, content]) => !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content,
)

if (checkOnly) {
  if (changedPaths.length > 0 || stalePaths.length > 0) {
    const changed = [...changedPaths.map(([filePath]) => filePath), ...stalePaths]
      .map((filePath) => path.relative(root, filePath))
      .join(', ')
    throw new Error(`Generated formulary chunks are stale: ${changed}. Run npm run data:split.`)
  }
  console.log(`Formulary chunks match ${formulary.guides.length} canonical guides.`)
  process.exit(0)
}

fs.mkdirSync(guidesDir, { recursive: true })
for (const stalePath of stalePaths) fs.rmSync(stalePath)
for (const [filePath, content] of changedPaths) fs.writeFileSync(filePath, content)
console.log(`Wrote ${formulary.guides.length} guide chunks from src/data/formulary.json.`)
