/**
 * @jest-environment node
 */
// node env: fixtureRespond builds web-standard Responses, which jsdom strips.
//
// The EUR withdrawal fixture (TASK-19427) answers the quote for ONE currency at
// a fixed Bridge rate. These tests run its replies through the real client
// check (quoteAnswersRequest) and pin that every other request keeps the
// demo's 1:1 estimate.
import { quoteAnswersRequest } from '@/utils/offramp-quote.utils'
import { fixtureRespond } from '@/dev/fixtures/respond'
import { simulatedWithdrawalQuote } from '@/dev/fixtures/registry'
import { deriveGate } from '@/utils/capability-gate'
import { getBankRailCountryFromAccount } from '@/utils/bridge.utils'

// demo-api → general.utils → app/actions/clients starts viem RPC timers that
// keep the worker alive; nothing here needs them.
jest.mock('@/app/actions/clients', () => ({}))

let activeFixture: string | null = null
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => activeFixture }))

afterEach(() => {
    activeFixture = null
})

const quote = async (query: string) => {
    const response = await fixtureRespond(`/bridge/offramp/quote?${query}`)
    return { status: response.status, body: await response.json() }
}

type FixtureUser = {
    user: { bridgeCustomerId: string | null }
    identityVerification: { status: string }
    capabilities: Parameters<typeof deriveGate>[0] & { restrictions: unknown[] }
    accounts: Array<{ type: string; identifier: string; bridgeAccountId?: string; details?: { countryCode?: string } }>
}

/** GET /users/me as the fixture serves it: the demo user with the fixture's overrides merged in. */
const fixtureUser = async (): Promise<FixtureUser> => (await fixtureRespond('/users/me')).json()

/** The review's withdraw gate for the Spanish IBAN, through the real gate logic. */
const reviewGate = (me: FixtureUser) => {
    const iban = me.accounts.find((account) => account.type === 'iban')!
    return deriveGate(
        {
            rails: me.capabilities.rails,
            nextActions: me.capabilities.nextActions,
            identityVerified: me.identityVerification.status === 'verified',
            isLoading: false,
        },
        'withdraw',
        { channel: 'bank', country: getBankRailCountryFromAccount(iban) }
    )
}

/**
 * Synthetic browser QA: the bank-review fixture must reach POST create, so its
 * user carries everything the submit checks before it — never real KYC.
 */
describe('withdraw-bank-estimated-payout — verified Bridge user', () => {
    beforeEach(() => {
        activeFixture = 'withdraw-bank-estimated-payout'
    })

    it('passes the review withdraw gate for the Spanish IBAN (EU SEPA rail enabled, identity verified)', async () => {
        const me = await fixtureUser()
        const iban = me.accounts.find((account) => account.type === 'iban')!

        expect(getBankRailCountryFromAccount(iban)).toBe('EU')
        expect(me.identityVerification.status).toBe('verified')
        expect(me.capabilities.rails).toContainEqual(
            expect.objectContaining({ id: 'bridge.sepa_eu', country: 'EU', channel: 'bank', status: 'enabled' })
        )
        expect(me.capabilities.nextActions).toEqual([])
        expect(me.capabilities.restrictions).toEqual([])
        // not needs-enrollment (the "Unlock Spain" drawer), not accept-tos, no advisory pre-empt
        expect(reviewGate(me)).toEqual({ kind: 'ready' })
    })

    it('has the rest of what the submit checks before create: Bridge customer, Bridge account, wallet', async () => {
        const me = await fixtureUser()

        expect(me.user.bridgeCustomerId).toBe('fixture-bridge-customer')
        expect(me.accounts.find((account) => account.type === 'iban')?.bridgeAccountId).toBe('fixture-bridge-iban')
        // fixture mode publishes this kernel address; the balance reads only when it matches
        expect(me.accounts.find((account) => account.type === 'peanut-wallet')?.identifier).toBe(
            '0xdec0debad1dec0debad1dec0debad1dec0debad1'
        )
    })

    it('the demo user alone would not pass: no EU rail, so the gate asks for enrollment', async () => {
        activeFixture = 'withdraw'
        expect(reviewGate(await fixtureUser()).kind).toBe('needs-enrollment')
    })
})

describe('withdraw-bank-estimated-payout — the quote', () => {
    beforeEach(() => {
        activeFixture = 'withdraw-bank-estimated-payout'
    })

    it('prices a typed bank amount: €20 costs $22.34 at 0.8955 (USDC rounded up)', async () => {
        const before = Date.now()
        const { status, body } = await quote('destinationCurrency=eur&destinationAmount=20')

        expect(status).toBe(200)
        expect(body).toEqual({
            destinationCurrency: 'eur',
            rate: '0.8955',
            updatedAt: expect.any(String),
            destinationAmount: '20',
            sourceAmount: '22.34',
        })
        // fresh on every request
        expect(Date.parse(body.updatedAt)).toBeGreaterThanOrEqual(before)
        // what the app itself checks before it shows or confirms a quote
        expect(quoteAnswersRequest(body, 'eur', { destinationAmount: '20' })).toBe(true)
    })

    it('keeps typed USDC exactly: $12.01 buys about €10.75 (bank amount rounded down)', async () => {
        const { body } = await quote('destinationCurrency=eur&sourceAmount=12.01')

        expect(body).toMatchObject({ sourceAmount: '12.01', destinationAmount: '10.75' })
        expect(body).not.toHaveProperty('quoteId')
        expect(quoteAnswersRequest(body, 'eur', { sourceAmount: '12.01' })).toBe(true)
    })

    it('the amount step gets the rate only, at the same rate', async () => {
        const { body } = await quote('destinationCurrency=eur')

        expect(body).toMatchObject({ rate: '0.8955' })
        expect(body.sourceAmount).toBeUndefined()
    })

    it('another currency keeps the demo 1:1 estimate', async () => {
        const { body } = await quote('destinationCurrency=gbp&destinationAmount=20')
        expect(body).toMatchObject({ rate: '1', destinationAmount: '20', sourceAmount: '20' })
    })

    it('refuses an amount the API would refuse', async () => {
        expect((await quote('destinationCurrency=eur&destinationAmount=20.001')).status).toBe(400)
        expect((await quote('destinationCurrency=eur&sourceAmount=0.01')).status).toBe(400)
    })
})

describe('fixtures without a withdrawal quote', () => {
    it('keep the demo 1:1 estimate for the quote', async () => {
        activeFixture = 'withdraw'
        const { body } = await quote('destinationCurrency=eur&destinationAmount=20')
        expect(body).toMatchObject({ rate: '1', destinationAmount: '20' })
    })
})

describe('simulatedWithdrawalQuote', () => {
    it('answers only its own currency', () => {
        const replies = simulatedWithdrawalQuote('eur', '0.9000')
        const ask = (currency: string) =>
            replies['GET /bridge/offramp/quote'](
                `/bridge/offramp/quote?destinationCurrency=${currency}&sourceAmount=10`
            )
        expect(ask('eur')?.body).toMatchObject({ rate: '0.9000', sourceAmount: '10', destinationAmount: '9.00' })
        expect(ask('gbp')).toBeNull()
    })
})
