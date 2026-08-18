// Gate for DS 10 item 3 (TASK-21450): every peanut-api call goes through
// apiFetch (src/utils/api-fetch.ts). One fetch path = consistent auth headers,
// authReady gating, demo-mode routing, Content-Type handling, and Sentry
// error reporting. A direct fetchWithSentry(`${PEANUT_API_URL}…`) call
// bypasses all of it — this test fails the build when a new one appears.
//
// Detection is file-level co-occurrence: a `fetchWithSentry(` CALL plus any
// `PEANUT_API_URL` reference in the same non-test source file. That also
// catches URLs assembled in a variable before the call. fetchWithSentry
// against non-Peanut hosts (Uniswap, Mobula, JustaName health probes) is
// fine and does not trip this.
//
// If a file genuinely cannot use apiFetch, add it to EXEMPT below with a
// one-line reason — do not weaken the detection.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..', '..')

// Paths relative to src/, sorted. Each entry needs a reason.
const EXEMPT = new Set<string>([
    // the wrapper itself — apiFetch IS the one sanctioned fetchWithSentry(PEANUT_API_URL…) call
    'utils/api-fetch.ts',
])

function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        const p = join(dir, entry.name)
        if (entry.isDirectory()) yield* walk(p)
        else yield p
    }
}

describe('no direct fetchWithSentry calls against PEANUT_API_URL', () => {
    it('routes every peanut-api call through apiFetch', () => {
        const offenders: string[] = []
        for (const p of walk(SRC)) {
            if (!/\.(ts|tsx)$/.test(p)) continue
            if (/\.test\.(ts|tsx)$/.test(p)) continue
            const rel = relative(SRC, p)
            if (rel.includes('__tests__') || rel.includes('__mocks__')) continue
            if (EXEMPT.has(rel)) continue
            const text = readFileSync(p, 'utf8')
            if (text.includes('fetchWithSentry(') && text.includes('PEANUT_API_URL')) {
                offenders.push(rel)
            }
        }
        expect(offenders).toEqual([])
    })

    it('keeps the exemption list free of stale entries', () => {
        const stale: string[] = []
        for (const rel of EXEMPT) {
            let text: string
            try {
                text = readFileSync(join(SRC, rel), 'utf8')
            } catch {
                stale.push(`${rel} (file no longer exists)`)
                continue
            }
            if (!text.includes('fetchWithSentry(') || !text.includes('PEANUT_API_URL')) {
                stale.push(`${rel} (no longer needs the exemption)`)
            }
        }
        expect(stale).toEqual([])
    })
})
