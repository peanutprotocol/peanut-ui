/**
 * @jest-environment node
 */
// node env: the WebView's global Response/Request are natively present in Node
// but stripped by jsdom. demo-api uses only web-standard APIs, so node is faithful.
import { demoRespond } from '@/utils/demo-api'
import { DEMO_CONTACTS, DEMO_HISTORY_ENTRIES, DEMO_USER } from '@/constants/demo-data'

const body = async (path: string, options?: RequestInit) => {
    const res = await demoRespond(path, options)
    return { res, data: await res.json() }
}

describe('demoRespond — routing', () => {
    it('returns the synthetic user for GET /users/me', async () => {
        const { res, data } = await body('/users/me')
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('application/json')
        expect(data.user.username).toBe(DEMO_USER.user.username)
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
