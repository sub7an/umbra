// Fails if any git-tracked *.json has both top-level "key" and "solution" fields.
// Answer keys belong in the private umbra-content repo, never in this public one.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function hasAnswerKey(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.hasOwn(obj, 'key') && Object.hasOwn(obj, 'solution')
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z', '*.json'], { encoding: 'utf8' })
    .split('\0').filter(Boolean)
  const bad = []
  for (const f of files) {
    try { if (hasAnswerKey(JSON.parse(readFileSync(f, 'utf8')))) bad.push(f) } catch { /* unreadable or non-JSON: skip */ }
  }
  if (bad.length) {
    console.error('Answer keys must not be committed to this public repo:')
    for (const f of bad) console.error(`  ${f}`)
    process.exit(1)
  }
  console.log(`check-no-answers: ${files.length} tracked JSON file(s) clean`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
