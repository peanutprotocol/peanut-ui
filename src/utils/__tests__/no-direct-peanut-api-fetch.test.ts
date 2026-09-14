// Gate for DS 10 item 3 (TASK-21450): every peanut-api call goes through
// apiFetch (src/utils/api-fetch.ts). One fetch path = consistent auth headers,
// authReady gating, demo-mode routing, Content-Type handling, and Sentry
// error reporting. A direct fetchWithSentry(`${PEANUT_API_URL}…`) call — or a
// raw fetch(`${PEANUT_API_URL}…`) call, which additionally skips Sentry
// reporting and the timeout budget — bypasses all of it; this test fails the
// build when a new one appears.
//
// Detection is file-level co-occurrence: a `fetchWithSentry(` or bare `fetch(`
// CALL plus any `PEANUT_API_URL` reference in the same non-test source file.
// That also catches URLs assembled in a variable before the call, and the
// NEXT_PUBLIC_PEANUT_API_URL env var read. fetchWithSentry/fetch against
// non-Peanut hosts (Uniswap, Mobula, JustaName health probes) is fine and
// does not trip this. `apiFetch(`, `serverFetch(`, `refetch(` etc. do not
// match the bare-fetch pattern (word boundary).
//
// If a file genuinely cannot use apiFetch, add it to EXEMPT below with a
// one-line reason — do not weaken the detection.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = join(__dirname, '..', '..')

// Paths relative to src/, sorted. Each entry needs a reason.
const EXEMPT = new Set<string>([
    // dev-only debug console POSTing harness routes with x-test-harness-secret —
    // deliberately outside the app session layer; migration out of scope
    'app/(mobile-ui)/dev/debug/page.tsx',
    // server-side health probe of /healthz — runs in a route handler where the
    // client session/Sentry wrapper does not apply
    'app/api/health/backend/route.ts',
    // production claim path on raw fetch — PRE-EXISTING debt, migration is a
    // deliberate follow-up (claim moves money; not batched into this refactor)
    'components/Claim/useClaimLink.tsx',
    // dev debug surface (harness-gated) — migration out of scope, same class
    // as dev/debug/page.tsx
    'context/PeanutDebug.tsx',
    // harness-only reproduce bootstrap reading NEXT_PUBLIC_PEANUT_API_URL —
    // runs pre-session by design
    'context/ReproduceBootstrap.tsx',
    // the wrapper itself — apiFetch IS the one sanctioned fetchWithSentry(PEANUT_API_URL…) call
    'utils/api-fetch.ts',
    // transport canary: a BARE fetch against the API is the instrument here —
    // routing it through apiFetch would measure apiFetch, not the WebView
    'utils/native-canary.ts',
    // failure-classifier probes /healthz with cors + no-cors modes to tell a
    // WAF challenge from a dead radio; apiFetch cannot express either mode
    'utils/network-triage.ts',
    // sanctioned demo-mode passthrough: forwards public GETs to the real
    // backend, deliberately without Sentry/auth (it IS the apiFetch demo leg)
    'utils/demo-api.ts',
])

// bare fetch( — word boundary keeps apiFetch(, serverFetch(, refetch(,
// prefetch( and fetchWithSentry( out; window.fetch( / global.fetch( still match
const BARE_FETCH_RE = /\bfetch\s*\(/
// whitespace-tolerant so `fetchWithSentry (…)` can't slip past the gate
const FETCH_WITH_SENTRY_RE = /\bfetchWithSentry\s*\(/

const tripsGate = (text: string): boolean =>
    text.includes('PEANUT_API_URL') && (FETCH_WITH_SENTRY_RE.test(text) || BARE_FETCH_RE.test(text))

function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        const p = join(dir, entry.name)
        if (entry.isDirectory()) yield* walk(p)
        else yield p
    }
}

describe('no direct fetchWithSentry/fetch calls against PEANUT_API_URL', () => {
    it('routes every peanut-api call through apiFetch', () => {
        const offenders: string[] = []
        for (const p of walk(SRC)) {
            if (!/\.(ts|tsx)$/.test(p)) continue
            if (/\.test\.(ts|tsx)$/.test(p)) continue
            // posix-normalized so EXEMPT matches on Windows checkouts too
            const rel = relative(SRC, p).split(sep).join('/')
            if (rel.includes('__tests__') || rel.includes('__mocks__')) continue
            if (EXEMPT.has(rel)) continue
            if (tripsGate(readFileSync(p, 'utf8'))) {
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
            if (!tripsGate(text)) {
                stale.push(`${rel} (no longer needs the exemption)`)
            }
        }
        expect(stale).toEqual([])
    })

    it('keeps the wrapper down to exactly one sanctioned direct call', () => {
        // The whole-file exemption above would hide a SECOND direct call added
        // to api-fetch.ts — pin the count so that can't happen silently.
        const text = readFileSync(join(SRC, 'utils/api-fetch.ts'), 'utf8')
        expect(text.match(/\bfetchWithSentry\s*\(/g)).toHaveLength(1)
    })
})
