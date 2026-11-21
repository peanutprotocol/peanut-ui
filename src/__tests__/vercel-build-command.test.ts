/**
 * Vercel's buildCommand once called `next build` directly, which skipped the
 * prebuild generators. The legal-version generator was one of them, and its
 * stale output caused the 2026-11-20 re-consent loop (TASK-25073). The build
 * goes through `pnpm build`, so every prebuild step runs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..', '..')
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { buildCommand: string }
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

describe('vercel.json buildCommand', () => {
    test('runs the package build script, so prebuild runs too', () => {
        expect(vercel.buildCommand).toMatch(/&& pnpm build$/)
        expect(vercel.buildCommand).not.toMatch(/next build/)
        expect(pkg.scripts.prebuild).toBeDefined()
    })
})
