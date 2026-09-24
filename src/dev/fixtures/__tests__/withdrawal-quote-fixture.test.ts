/**
 * @jest-environment node
 */
// node env: fixtureRespond builds web-standard Responses, which jsdom strips.
//
// The fees-v2 withdrawal fixtures (TASK-19427) answer the signed quote and the
// public rate for ONE currency, and only for a client that asks for
// fixed_output. These tests run the replies through the real client contract
// (fetchOfframpRate, quoteAnswersRequest) and pin that every other request
// keeps the demo's Bridge-rate estimate.
import { fetchOfframpRate, FxApiError } from '@/utils/fx.utils'
import { isFixedOutputQuote, quoteAnswersRequest } from '@/utils/offramp-quote.utils'
import { fixtureRespond } from '@/dev/fixtures/respond'
import { FIXTURES, simulatedWithdrawalPricing } from '@/dev/fixtures/registry'
import { deriveGate } from '@/utils/capability-gate'
import { getBankRailCountryFromAccount } from '@/utils/bridge.utils'

// demo-api → general.utils → app/actions/clients starts viem RPC timers that
// keep the worker alive; nothing here needs them.
jest.mock('@/app/actions/clients', () => ({}))

let activeFixture: string | null = null
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => activeFixture }))

// In fixture mode api-fetch hands every call to fixtureRespond.
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, options?: RequestInit) =>
        jest
            .requireActual<typeof import('@/dev/fixtures/respond')>('@/dev/fixtures/respond')
            .fixtureRespond(path, options),
}))

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
 * Synthetic browser QA: the bank-review fixtures must reach POST create, so
 * their user carries everything the submit checks before it — never real KYC.
 */
describe.each(['withdraw-bank-fixed-output', 'withdraw-bank-quote-expired'])('%s — verified Bridge user', (name) => {
    beforeEach(() => {
        activeFixture = name
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

describe('withdraw-bank-quote-expired — the Withdraw button reaches create', () => {
    it('create answers 409 BRIDGE_QUOTE_EXPIRED, whatever it is sent', async () => {
        activeFixture = 'withdraw-bank-quote-expired'
        const create = await fixtureRespond('/bridge/offramp/create', {
            method: 'POST',
            body: JSON.stringify({ quoteId: 'fixture-quote-eur-1', amount: '22.29' }),
        })
        expect(create.status).toBe(409)
        expect((await create.json()).code).toBe('BRIDGE_QUOTE_EXPIRED')
    })
})

describe('withdraw-bank-fixed-output', () => {
    beforeEach(() => {
        activeFixture = 'withdraw-bank-fixed-output'
    })

    it('signs a quote for a typed bank amount: €20.00 costs $22.29 at 0.8973 (USDC rounded up)', async () => {
        const before = Date.now()
        const { status, body } = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')

        expect(status).toBe(200)
        expect(body).toMatchObject({
            destinationCurrency: 'eur',
            rate: '0.8973',
            destinationAmount: '20.00',
            sourceAmount: '22.29',
            pricing: 'fixed_output',
        })
        expect(body.quoteId).toMatch(/^fixture-quote-eur-\d+$/)
        // fresh on every request, with the API's 2-minute lifetime
        expect(Date.parse(body.updatedAt)).toBeGreaterThanOrEqual(before)
        expect(Date.parse(body.expiresAt) - Date.parse(body.updatedAt)).toBe(2 * 60 * 1000)
        // what the app itself checks before it shows or confirms a quote
        expect(quoteAnswersRequest(body, 'eur', { destinationAmount: '20' })).toBe(true)
        expect(isFixedOutputQuote(body)).toBe(true)
    })

    it('prices typed USDC too: $50.00 buys €44.86 (bank amount rounded down)', async () => {
        const { body } = await quote('destinationCurrency=eur&pricing=fixed_output&sourceAmount=50')

        expect(body).toMatchObject({ sourceAmount: '50.00', destinationAmount: '44.86', pricing: 'fixed_output' })
        expect(quoteAnswersRequest(body, 'eur', { sourceAmount: '50' })).toBe(true)
    })

    it('each signed quote has its own id, so a discarded one is never shown again', async () => {
        const first = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')
        const second = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')
        expect(second.body.quoteId).not.toBe(first.body.quoteId)
    })

    it('the amount step gets the rate only, unsigned, at the same rate', async () => {
        const { body } = await quote('destinationCurrency=eur&pricing=fixed_output')

        expect(body).toMatchObject({ rate: '0.8973', pricing: 'fixed_output' })
        expect(body.quoteId).toBeUndefined()
        expect(isFixedOutputQuote(body)).toBe(false)
    })

    it('the public rate matches the signed quote and passes the real contract', async () => {
        await expect(fetchOfframpRate('EUR')).resolves.toBe(0.8973)
    })

    it('an older client (no pricing=fixed_output) keeps the demo Bridge-rate estimate', async () => {
        const { body } = await quote('destinationCurrency=eur&destinationAmount=20')

        expect(body).toMatchObject({ rate: '1', pricing: 'bridge_rate', sourceAmount: '20' })
        expect(body.quoteId).toBeUndefined()
    })

    it('another currency keeps the demo estimate, and its public rate stays unavailable', async () => {
        const { body } = await quote('destinationCurrency=gbp&pricing=fixed_output&destinationAmount=20')
        expect(body.pricing).toBe('bridge_rate')
        await expect(fetchOfframpRate('GBP')).rejects.toMatchObject({ status: 503 })
    })

    it('refuses an amount the API would refuse', async () => {
        expect((await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20.001')).status).toBe(400)
        expect((await quote('destinationCurrency=eur&pricing=fixed_output&sourceAmount=0.01')).status).toBe(400)
    })
})

describe('withdraw-bank-quote-expired', () => {
    it('create refuses the quote; the requote has new numbers, and the public rate follows it', async () => {
        activeFixture = 'withdraw-bank-quote-expired'

        const first = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')
        expect(first.body).toMatchObject({ rate: '0.8973', sourceAmount: '22.29' })

        const create = await fixtureRespond('/bridge/offramp/create', { method: 'POST', body: '{}' })
        expect(create.status).toBe(409)
        expect(await create.json()).toEqual({
            error: 'This quote has expired. Get a new quote.',
            code: 'BRIDGE_QUOTE_EXPIRED',
        })

        const second = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')
        expect(second.body).toMatchObject({ rate: '0.8964', destinationAmount: '20.00', sourceAmount: '22.32' })
        expect(second.body.quoteId).not.toBe(first.body.quoteId)
        await expect(fetchOfframpRate('EUR')).resolves.toBe(0.8964)
    })
})

describe('rates-withdrawal-fixed-output', () => {
    it('opens Rates & fees on USD → EUR and answers its public rate', async () => {
        activeFixture = 'rates-withdrawal-fixed-output'
        expect(FIXTURES['rates-withdrawal-fixed-output'].route).toBe(
            '/profile/exchange-rate?from=USD&to=EUR&amount=100'
        )
        await expect(fetchOfframpRate('EUR')).resolves.toBe(0.8973)
    })
})

describe('fixtures without withdrawal pricing', () => {
    it('keep the offline 503 for the public rate, as before', async () => {
        activeFixture = 'withdraw'
        await expect(fetchOfframpRate('EUR')).rejects.toBeInstanceOf(FxApiError)
    })

    it('keep the demo Bridge-rate estimate for the quote', async () => {
        activeFixture = 'withdraw'
        const { body } = await quote('destinationCurrency=eur&pricing=fixed_output&destinationAmount=20')
        expect(body).toMatchObject({ rate: '1', pricing: 'bridge_rate', destinationAmount: '20' })
    })
})

describe('simulatedWithdrawalPricing', () => {
    it('repeats its last rate once every listed rate was used', () => {
        const pricing = simulatedWithdrawalPricing('eur', ['0.9000', '0.8900'])
        const ask = () =>
            pricing['GET /bridge/offramp/quote'](
                '/bridge/offramp/quote?destinationCurrency=eur&pricing=fixed_output&sourceAmount=10'
            )
        expect((ask()?.body as { rate: string }).rate).toBe('0.9000')
        expect((ask()?.body as { rate: string }).rate).toBe('0.8900')
        expect((ask()?.body as { rate: string }).rate).toBe('0.8900')
    })
})
