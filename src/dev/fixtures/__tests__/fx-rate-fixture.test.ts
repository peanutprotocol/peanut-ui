/**
 * @jest-environment node
 */
// node env: fixtureRespond builds web-standard Responses, which jsdom strips.
//
// The Rates & fees fixtures (TASK-19427) are the one place a fixture must turn
// the offline demo's 503 for GET /fx/rate into a success. These tests run the
// simulated reply through the REAL fetchDisplayRate contract, and pin that
// every path without a reply still fails closed.
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'
import { fixtureRespond } from '@/dev/fixtures/respond'
import { FIXTURES, simulatedFxRate } from '@/dev/fixtures/registry'

// demo-api → general.utils → app/actions/clients starts viem RPC timers that
// keep the worker alive; nothing here needs them.
jest.mock('@/app/actions/clients', () => ({}))

let activeFixture: string | null = null
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => activeFixture }))

// The one seam the app calls the API through; in fixture mode api-fetch hands
// every call to fixtureRespond, which is what fetchDisplayRate then parses.
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, options?: RequestInit) =>
        jest
            .requireActual<typeof import('@/dev/fixtures/respond')>('@/dev/fixtures/respond')
            .fixtureRespond(path, options),
}))

afterEach(() => {
    activeFixture = null
})

describe('rates-and-fees fixtures', () => {
    it.each(['rates-and-fees', 'rates-and-fees-below-minimum'])(
        '%s answers USD → BRL with a quote the real contract accepts',
        async (name) => {
            activeFixture = name
            await expect(fetchDisplayRate('USD', 'BRL')).resolves.toBe(5)
        }
    )

    it('stamps the timestamps at request time, so the reply is fresh whenever it is read', async () => {
        activeFixture = 'rates-and-fees'
        const before = Date.now()
        const response = await fixtureRespond('/fx/rate?from=USD&to=BRL')
        const body = await response.json()
        expect(response.status).toBe(200)
        expect(Date.parse(body.generatedAt)).toBeGreaterThanOrEqual(before)
        expect(body.effectiveAt).toBe(body.generatedAt)
        expect(body).toMatchObject({
            from: 'USD',
            to: 'BRL',
            rate: '5',
            basis: 'display_sell',
            indicative: true,
            selection: 'provider_pair',
            fromSource: 'identity',
            toSource: 'manteca',
        })
    })

    it('quotes only its named pair: the swapped pair stays unavailable', async () => {
        activeFixture = 'rates-and-fees'
        await expect(fetchDisplayRate('BRL', 'USD')).rejects.toMatchObject({ name: 'FxApiError', status: 503 })
    })

    it('rates-and-fees-unavailable has no reply, so the rate stays unavailable', async () => {
        activeFixture = 'rates-and-fees-unavailable'
        expect(FIXTURES['rates-and-fees-unavailable'].replies).toBeUndefined()
        await expect(fetchDisplayRate('USD', 'BRL')).rejects.toBeInstanceOf(FxApiError)
    })

    it('every other fixture still gets the offline 503 for a rate', async () => {
        activeFixture = 'profile'
        await expect(fetchDisplayRate('USD', 'BRL')).rejects.toMatchObject({ status: 503 })
    })

    it('names the amounts the screenshots must show', () => {
        expect(FIXTURES['rates-and-fees'].route).toBe('/profile/exchange-rate?from=USD&to=BRL&amount=10')
        expect(FIXTURES['rates-and-fees-below-minimum'].route).toBe('/profile/exchange-rate?from=USD&to=BRL&amount=0.1')
        expect(FIXTURES['rates-and-fees-unavailable'].route).toBe('/profile/exchange-rate?from=USD&to=BRL&amount=10')
    })
})

describe('fixture replies', () => {
    it('a reply that answers null falls through to the demo default', () => {
        const reply = simulatedFxRate('USD', 'BRL', '5')
        expect(reply('/fx/rate?from=USD&to=ARS')).toBeNull()
        expect(reply('/fx/rate?from=USD&to=BRL')?.status).toBe(200)
    })

    // last in the file: it swaps the registry for a fresh module graph
    it('a declared failure wins over a reply for the same route', async () => {
        jest.resetModules()
        jest.doMock('@/dev/fixtures/registry', () => ({
            FIXTURES: {
                both: {
                    route: '/profile/exchange-rate',
                    about: 'test',
                    fails: ['GET /fx/rate'],
                    replies: { 'GET /fx/rate': { status: 200, body: {} } },
                },
            },
        }))
        jest.doMock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => 'both' }))
        const { fixtureRespond: respond } = require('@/dev/fixtures/respond') as typeof import('@/dev/fixtures/respond')
        expect((await respond('/fx/rate?from=USD&to=BRL')).status).toBe(500)
    })
})
