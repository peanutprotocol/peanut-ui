// Answers an API call from the active fixture. Loaded lazily from api-fetch,
// behind DEV_TOOLS_ENABLED, so no reachable production code path runs it.
// (The chunk itself is still emitted — webpack creates one for every import()
// it finds in the source, dead branch or not. Same for /dev/devices.)

import { demoRespond } from '@/utils/demo-api'
import { FIXTURES } from './registry'
import { ensureActiveFixture } from './active'
import { isStressActive, stressResponse } from './stress'
import { setFixtureBalanceUnits } from '@/utils/demo-balance'
import { parseUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'
import type { IUserProfile } from '@/interfaces/interfaces'
import { withFixtureFeatureReport, withFixtureRoutes } from './featureReport'

const JSON_HEADERS = { 'content-type': 'application/json' }

let warned = false
/** Fixtures whose watched deposit has landed: their balance is `balanceAfterDeposit` for the rest of the tab. */
const creditedFixtures = new Set<string>()
/** Rhino status reads answered per fixture: the deposit is not sent, then on its way, then landed */
const statusReads = new Map<string, number>()

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/** Objects merge key by key. Arrays and primitives replace, so `[]` empties a list. */
function merge(base: unknown, patch: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) out[key] = merge(out[key], value)
    return out
}

export async function fixtureRespond(path: string, options?: RequestInit): Promise<Response> {
    const name = ensureActiveFixture()
    const fixture = name ? FIXTURES[name] : undefined
    if (!fixture) {
        if (!warned) {
            warned = true
            console.error(
                `[fixtures] unknown fixture "${name}". Valid names:\n  ${Object.keys(FIXTURES).sort().join('\n  ')}`
            )
        }
        // Still serve the demo defaults — a wrong name must not hang the screen.
        return demoRespond(path, options, { offline: true })
    }

    const balance = creditedFixtures.has(name!) ? fixture.balanceAfterDeposit : fixture.balance
    if (balance !== undefined) setFixtureBalanceUnits(parseUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

    const method = (options?.method ?? 'GET').toUpperCase()
    const key = `${method} ${path.split('?')[0].replace(/\/+$/, '')}`

    // No fixture call reaches the network, so a spec cannot see requests there.
    // A spec that creates this list reads each call the page made from it.
    ;(window as Window & { __fixtureRequests?: string[] }).__fixtureRequests?.push(`${method} ${path}`)

    if (fixture.fails?.includes(key)) {
        return new Response(JSON.stringify({ error: 'fixture failure' }), { status: 500, headers: JSON_HEADERS })
    }
    const rejection = fixture.rejects?.[key]
    if (rejection) {
        return new Response(JSON.stringify(rejection.body), { status: rejection.status, headers: JSON_HEADERS })
    }

    // demo-api already answers every route the app calls, with a shape-aware
    // fallback for the rest. A fixture only says what differs from that.
    const override = fixture.responses?.[key]
    // This new endpoint has no demo response yet; a named fixture provides its complete response.
    if (
        override !== undefined &&
        (fixture.completeResponses?.includes(key) ||
            key === 'GET /users/kyc/bridge-postal-code' ||
            key === 'POST /users/kyc/bridge-postal-code')
    ) {
        return new Response(JSON.stringify(override), { status: 200, headers: JSON_HEADERS })
    }
    const base = await demoRespond(path, options, { offline: true })
    const stress = isStressActive() && !!base.headers.get('content-type')?.includes('json')
    if (override === undefined && !stress && key !== 'GET /users/me') return base

    const data = await base.json().catch(() => ({}))
    let merged = override === undefined ? data : merge(data, override)
    if (key === 'GET /users/me') {
        const paperworkBase = await demoRespond('/users/kyc/paperwork', undefined, { offline: true })
        const paperworkData = await paperworkBase.json().catch(() => ({}))
        const paperworkOverride = fixture.responses?.['GET /users/kyc/paperwork']
        const paperwork = paperworkOverride === undefined ? paperworkData : merge(paperworkData, paperworkOverride)
        merged = withFixtureRoutes(
            withFixtureFeatureReport(
                merged as IUserProfile | null,
                override as Partial<IUserProfile> | null | undefined,
                paperwork as Parameters<typeof withFixtureFeatureReport>[2]
            ),
            override as Partial<IUserProfile> | null | undefined
        )
    }
    // A watched deposit arrives as a user's own transfer would: the read at open answers "nothing
    // sent yet" (the address shows), the next one "on its way" (processing shows), then it lands.
    if (fixture.balanceAfterDeposit !== undefined && key.startsWith('GET /rhino/status/')) {
        const reads = statusReads.get(name!) ?? 0
        if (reads < 2) {
            statusReads.set(name!, reads + 1)
            const status = reads === 0 ? 'not_started' : 'pending'
            return new Response(JSON.stringify({ status }), { status: 200, headers: JSON_HEADERS })
        }
    }
    if (
        fixture.balanceAfterDeposit !== undefined &&
        key.startsWith('GET /rhino/status/') &&
        (merged as { status?: string } | null)?.status === 'completed'
    ) {
        creditedFixtures.add(name!)
        setFixtureBalanceUnits(parseUnits(fixture.balanceAfterDeposit, PEANUT_WALLET_TOKEN_DECIMALS))
    }
    return new Response(JSON.stringify(stress ? stressResponse(merged) : merged), {
        status: base.status,
        headers: JSON_HEADERS,
    })
}
