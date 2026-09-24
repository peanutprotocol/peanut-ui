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
