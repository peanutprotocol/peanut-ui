/**
 * @jest-environment node
 */
// node env: the WebView's global Response/Request are natively present in Node
// but stripped by jsdom. demo-api uses only web-standard APIs, so node is faithful.
import { demoRespond } from '@/utils/demo-api'
import { DEMO_CONTACTS, DEMO_HISTORY_ENTRIES, DEMO_USER } from '@/constants/demo-data'
import { PEANUT_API_URL } from '@/constants/general.consts'

// The web-safe test requires @/utils/demo → general.utils → app/actions/clients, whose
// module-scope viem clients start 60s RPC-ranking timers (fallback rank) that keep the
// Jest worker alive → "force exited" warning. Nothing here needs the clients.
jest.mock('@/app/actions/clients', () => ({}))

// The web-safe test requires @/utils/demo → general.utils → app/actions/clients, whose
// module-scope viem clients start 60s RPC-ranking timers (fallback rank) that keep the
// Jest worker alive → "force exited" warning. Nothing here needs the clients.

const body = async (path: string, options?: RequestInit) => {
    const res = await demoRespond(path, options)
    return { res, data: await res.json() }
}

describe('demoRespond — routing', () => {
    it('answers wallet-portfolio synthetically instead of hitting the owner-only endpoint', async () => {
        const originalFetch = global.fetch
        global.fetch = jest.fn()
        try {
            const { res, data } = await body('/tokens/wallet-portfolio?address=0xdemo')
            expect(res.status).toBe(200)
            expect(data).toEqual({ balances: [], totalBalance: 0 })
            expect(global.fetch).not.toHaveBeenCalled()
        } finally {
            global.fetch = originalFetch
        }
    })

    it('bounds and forwards the shared FX passthrough', async () => {
        const originalFetch = global.fetch
        global.fetch = jest.fn().mockResolvedValue(
            new Response(JSON.stringify({ rate: '1' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        )

        try {
            const { data } = await body('/fx/rate?from=USD&to=USD')

            expect(data).toEqual({ rate: '1' })
            expect(global.fetch).toHaveBeenCalledWith(
                `${PEANUT_API_URL}/fx/rate?from=USD&to=USD`,
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            )
        } finally {
            global.fetch = originalFetch
        }
    })

    it('returns the synthetic user for GET /users/me', async () => {
        const { res, data } = await body('/users/me')
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('application/json')
        expect(data.user.username).toBe(DEMO_USER.user.username)
    })

    it('answers the verified-address read the bank form makes on open, even in strict capture mode', async () => {
        // The form asks for it the moment it opens with "this account is mine"
        // ticked. Unmapped, strict mode throws and the screen-capture harness
        // fails the screen ("Missing synthetic responses").
        const res = await demoRespond('/users/me/verified-address', { method: 'GET' }, { offline: true, strict: true })
        expect(res.status).toBe(200)
        // Nothing to prefill, so the form asks — no synthetic address is served.
        expect(await res.json()).toEqual({})
    })

    it('only advertises badges with live unlock paths in the demo catalog', async () => {
        const { data } = await body('/badge/catalog')
        const codes = data.badges.map(({ code }: { code: string }) => code)

        expect(codes).toEqual(expect.arrayContaining(['CARD_FIRST_SWIPE', 'CARD_SPENT_1K', 'ENS', 'SURF_UP']))
        expect(codes).not.toEqual(
            expect.arrayContaining(['FIRST_INVITE', 'SECOND_INVITE', 'VERIFIED', 'OG_2025_10_12'])
        )
    })

    it('returns populated contacts for GET /users/contacts', async () => {
        const { data } = await body('/users/contacts?limit=20&offset=0')
        expect(data.contacts).toHaveLength(DEMO_CONTACTS.length)
        expect(data.total).toBe(DEMO_CONTACTS.length)
        expect(data.hasMore).toBe(false)
    })

    it('ignores the query string when matching', async () => {
        const { data } = await body('/users/history?cursor=abc&limit=50')
        expect(data.entries).toHaveLength(DEMO_HISTORY_ENTRIES.length)
        expect(data.hasMore).toBe(false)
    })

    it('extracts path params for GET /requests/:uuid', async () => {
        const { data } = await body('/requests/req-123')
        expect(data.uuid).toBe('req-123')
    })

    it('echoes the requested amount back on POST /requests', async () => {
        const { data } = await body('/requests', {
            method: 'POST',
            body: JSON.stringify({ tokenAmount: '42.50' }),
        })
        expect(data.tokenAmount).toBe('42.50')
    })

    it('treats GET /requests (search) as "none found" via 404', async () => {
        const { res } = await body('/requests?recipient=demo')
        expect(res.status).toBe(404)
    })

    it('returns a terminal claim status for the optimistic-claim poll', async () => {
        const { res, data } = await body('/send-links/demo-pubkey/status?c=42161&v=v4.4&i=0')

        expect(res.status).toBe(200)
        expect(data).toMatchObject({ pubKey: 'demo-pubkey', status: 'CLAIMED' })
    })

    it('returns a believable off-ramp success for POST /bridge/offramp/create', async () => {
        const { data } = await body('/bridge/offramp/create', { method: 'POST', body: '{}' })
        expect(data.transferId).toBeTruthy()
        expect(data.depositInstructions.toAddress).toBeTruthy()
    })

    it('routes by method — DELETE cancel returns success', async () => {
        const { data } = await body('/bridge/onramp/t1/cancel', { method: 'DELETE' })
        expect(data.success).toBe(true)
    })

    it('stamps activationCelebratedAt after dismiss so the unlock modal shows once', async () => {
        // first load: not yet celebrated → home opens the "You're unlocked" modal
        const before = await body('/users/me')
        expect(before.data.user.activationCelebratedAt).toBeFalsy()

        // dismissing the modal PATCHes the user with dismissActivationCelebration
        await body('/update-user', {
            method: 'POST',
            body: JSON.stringify({ username: 'demo', dismissActivationCelebration: true }),
        })

        // subsequent loads report it stamped → the modal stays dismissed
        const after = await body('/users/me')
        expect(after.data.user.activationCelebratedAt).toBeTruthy()
    })

    it('keeps the picked avatar between update-user and users/me, null clears it', async () => {
        // a pick made through the picker (TASK-22142) must survive the refetch
        // that follows it, or the tile snaps back to the initial in demo mode
        expect((await body('/users/me')).data.user.avatarKey).toBeNull()

        await body('/update-user', {
            method: 'POST',
            body: JSON.stringify({ username: 'demo', avatarKey: 'basic.frog' }),
        })
        expect((await body('/users/me')).data.user.avatarKey).toBe('basic.frog')

        // a body without the field leaves the pick alone, as the API does
        await body('/update-user', { method: 'POST', body: JSON.stringify({ username: 'demo', showFullName: true }) })
        expect((await body('/users/me')).data.user.avatarKey).toBe('basic.frog')

        await body('/update-user', { method: 'POST', body: JSON.stringify({ username: 'demo', avatarKey: null }) })
        expect((await body('/users/me')).data.user.avatarKey).toBeNull()
    })

    it('persists the celebration stamp across cold starts via localStorage', async () => {
        // in-memory-only state re-showed the modal on every demo launch; a fresh
        // module registry per isolateModules block simulates the cold start
        const store: Record<string, string> = {}
        ;(globalThis as { window?: unknown }).window = {
            localStorage: {
                getItem: (k: string) => store[k] ?? null,
                setItem: (k: string, v: string) => {
                    store[k] = v
                },
            },
        }
        try {
            await jest.isolateModulesAsync(async () => {
                const { demoRespond: freshRespond } = await import('@/utils/demo-api')
                await freshRespond('/update-user', {
                    method: 'POST',
                    body: JSON.stringify({ username: 'demo', dismissActivationCelebration: true }),
                })
            })
            await jest.isolateModulesAsync(async () => {
                const { demoRespond: freshRespond } = await import('@/utils/demo-api')
                const data = await (await freshRespond('/users/me')).json()
                expect(data.user.activationCelebratedAt).toBeTruthy()
            })
        } finally {
            delete (globalThis as { window?: unknown }).window
        }
    })
})

describe('demoRespond — rain card overview', () => {
    it('returns a full RainCardOverview shape (useRainCardOverview derefs .status, cardState derefs .cards)', async () => {
        const { res, data } = await body('/rain/cards')
        expect(res.status).toBe(200)
        expect(data.status.hasApplication).toBe(false)
        expect(data.balance).toBeNull()
        expect(Array.isArray(data.cards)).toBe(true)
    })
})

describe('demoRespond — shape-aware fallback (never throws on undefined.map)', () => {
    it('returns [] for an unmatched collection-ish path', async () => {
        const { res, data } = await body('/something/payments')
        expect(res.status).toBe(200)
        expect(Array.isArray(data)).toBe(true)
    })

    it('returns {} for an unmatched object path', async () => {
        const { data } = await body('/totally/unknown/thing')
        expect(Array.isArray(data)).toBe(false)
        expect(typeof data).toBe('object')
    })

    it('rewards endpoint returns an array (consumer maps over it)', async () => {
        const { data } = await body('/users/demo-user/rewards')
        expect(Array.isArray(data)).toBe(true)
    })

    it('invite-graph endpoints return an object with array fields (InvitesGraph derefs .nodes.length)', async () => {
        for (const path of ['/invites/user-graph', '/invites/graph']) {
            const { data } = await body(path)
            expect(Array.isArray(data)).toBe(false)
            expect(Array.isArray(data.nodes)).toBe(true)
            expect(Array.isArray(data.edges)).toBe(true)
            expect(typeof data.stats?.totalNodes).toBe('number')
        }
    })

    it('POST /charges returns a TCharge with data.id (withdraw "Failed to create charge")', async () => {
        const { data } = await body('/charges', { method: 'POST' })
        expect(data.data?.id).toBeTruthy()
        expect(Array.isArray(data.warnings)).toBe(true)
    })

    it('GET /request-charges/:id returns a usable charge with requestLink.recipientAddress', async () => {
        const { data } = await body('/request-charges/demo-charge')
        expect(data.requestLink?.recipientAddress).toBeTruthy()
        expect(data.uuid).toBe('demo-charge')
    })

    it('POST /rhino/deposit returns a deposit address (add-money crypto network crash)', async () => {
        const { data } = await body('/rhino/deposit', { method: 'POST' })
        expect(data.depositAddress).toBeTruthy()
        expect(typeof data.minDepositLimitUsd).toBe('number')
        expect(Array.isArray(data.supportedChains)).toBe(true)
    })

    it('GET /ens/:name resolves to an address (so ENS sends complete in demo)', async () => {
        const { data } = await body('/ens/vitalik.eth')
        expect(data.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('charge store carries the real amount + a random tx hash through to the receipt', async () => {
        // create a charge for $10 (as the send flow does)
        const { data: charge } = await body('/charges', {
            method: 'POST',
            body: JSON.stringify({
                local_price: { amount: '10', currency: 'USD' },
                requestProps: { tokenAmount: '10' },
            }),
        })
        const id = charge.data.id
        expect(id).toBeTruthy()

        // receipt fetches the charge → real amount, not 0; not the fixed 2026-01-01 date
        const { data: rc } = await body(`/request-charges/${id}`)
        expect(rc.tokenAmount).toBe('10')
        expect(rc.currencyAmount).toBe('10')
        expect(rc.createdAt).not.toBe('2026-01-01T00:00:00.000Z')

        // payment record → random tx hash (not 0xdede), and same amount
        const { data: pay } = await body(`/charges/${id}/payments`, { method: 'POST' })
        expect(pay.payerTransactionHash).toMatch(/^0x[a-f0-9]{64}$/)
        expect(pay.payerTransactionHash).not.toBe('0xdede')
        expect(pay.requestCharge.tokenAmount).toBe('10')
    })
})

describe('demo mode is web-safe', () => {
    afterEach(() => {
        jest.resetModules()
        jest.dontMock('@/utils/capacitor')
    })

    it('isDemoMode() is false when not running under Capacitor', () => {
        jest.resetModules()
        jest.doMock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
        const { isDemoMode, enableDemoMode } = require('@/utils/demo')
        enableDemoMode() // even with the flag set...
        expect(isDemoMode()).toBe(false) // ...web stays inert
    })
})

describe('demoRespond — card application', () => {
    it('walks apply → terms → pending like the real contract', async () => {
        const before = await body('/rain/cards')
        expect(before.data.status.hasApplication).toBe(false)

        const ask = await body('/rain/cards', { method: 'POST', body: JSON.stringify({ termsAccepted: false }) })
        expect(ask.data.status).toBe('terms-required')

        const accept = await body('/rain/cards', { method: 'POST', body: JSON.stringify({ termsAccepted: true }) })
        expect(accept.data.status).toBe('pending')

        const after = await body('/rain/cards')
        expect(after.data.status).toEqual({ hasApplication: true, railStatus: 'PENDING' })
    })
})

describe('demoRespond — withdraw quote (TASK-23054)', () => {
    it('answers the typed bank amount at a synthetic 1:1 rate, offline included', async () => {
        const res = await demoRespond(
            '/bridge/offramp/quote?destinationCurrency=eur&destinationAmount=50',
            { method: 'GET' },
            { offline: true, strict: true }
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ destinationCurrency: 'eur', rate: '1', sourceAmount: '50' })
    })

    it('answers only the rate before an amount is typed', async () => {
        const res = await demoRespond('/bridge/offramp/quote?destinationCurrency=gbp', { method: 'GET' })
        const body = await res.json()
        expect(body.rate).toBe('1')
        expect(body.sourceAmount).toBeUndefined()
    })

    it('answers typed USDC too, with both amounts at the same 1:1 rate', async () => {
        const res = await demoRespond(
            '/bridge/offramp/quote?destinationCurrency=eur&sourceAmount=50.12&pricing=fixed_output',
            { method: 'GET' },
            { offline: true, strict: true }
        )
        expect(await res.json()).toMatchObject({ sourceAmount: '50.12', destinationAmount: '50.12' })
    })

    it('is a Bridge-rate estimate, never a signed quote, even when fixed_output is asked for', async () => {
        const res = await demoRespond(
            '/bridge/offramp/quote?destinationCurrency=eur&destinationAmount=50&pricing=fixed_output',
            { method: 'GET' },
            { offline: true }
        )
        const body = await res.json()
        expect(body.pricing).toBe('bridge_rate')
        expect(body.quoteId).toBeUndefined()
        expect(body.expiresAt).toBeUndefined()
    })
})

describe('demoRespond — public withdrawal rate (fees v2)', () => {
    it('offline, answers 503 rather than a canned rate', async () => {
        const res = await demoRespond(
            '/bridge/offramp/rate?destinationCurrency=eur',
            { method: 'GET' },
            { offline: true, strict: true }
        )
        expect(res.status).toBe(503)
    })

    it('in native demo, passes the public rate through to the API, like /fx/rate', async () => {
        const originalFetch = global.fetch
        const live = {
            destinationCurrency: 'eur',
            rate: '0.8973',
            updatedAt: '2026-09-24T15:54:16.373Z',
            pricing: 'fixed_output',
        }
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify(live), { status: 200, headers: { 'content-type': 'application/json' } })
            )
        try {
            const res = await demoRespond('/bridge/offramp/rate?destinationCurrency=eur', { method: 'GET' })
            expect(await res.json()).toEqual(live)
            expect(global.fetch).toHaveBeenCalledWith(
                `${PEANUT_API_URL}/bridge/offramp/rate?destinationCurrency=eur`,
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            )
        } finally {
            global.fetch = originalFetch
        }
    })
})
