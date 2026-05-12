#!/usr/bin/env node
/**
 * Convert the BE's history-real-staging.jsonl into the FE's
 * render-snapshot input shape (a JSON array).
 *
 * Read stdin (JSONL), write stdout (JSON). Used in CI to import the
 * canonical 49-entry baseline from peanut-api-ts without vendoring a
 * copy in this repo — see .github/workflows/tests.yml and
 * src/components/TransactionDetails/__tests__/render-snapshot.test.tsx.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (args.length !== 2) {
    console.error('Usage: import-be-baseline.mjs <input.jsonl> <output.json>')
    process.exit(1)
}

const [inputPath, outputPath] = args
const raw = readFileSync(inputPath, 'utf-8')
const entries = raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
        try {
            return JSON.parse(line)
        } catch (err) {
            throw new Error(`Failed to parse JSONL line ${i + 1}: ${err.message}`)
        }
    })

writeFileSync(outputPath, JSON.stringify(entries, null, 4) + '\n')
console.error(`[import-be-baseline] wrote ${entries.length} entries → ${outputPath}`)
