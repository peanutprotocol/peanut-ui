import { fetchCardMarkup, fetchDisplayRate } from '../fx.utils'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.Mock

const validResponse = {
    from: 'PLN',
    to: 'EUR',
    rate: '0.2322191619648635',
    basis: 'display_sell',
    indicative: true,
    selection: 'reference_pair',
    fromSource: 'reference',
    toSource: 'reference',
    effectiveAt: '2026-08-04T00:00:00.000Z',
    generatedAt: '2026-08-05T08:00:00.000Z',
}

describe('fetchDisplayRate — shared backend contract', () => {
    beforeEach(() => {
        mockApiFetch.mockReset()
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-05T08:00:00.000Z'))
    })

    afterEach(() => jest.restoreAllMocks())

    it.each([
        ['three hours slow', '2026-08-05T05:00:00.000Z'],
        ['three hours fast', '2026-08-05T11:00:00.000Z'],
    ])('still accepts a valid response when the device clock is %s', async (_label, deviceNow) => {
        // A drifted device clock must not reject every rate the backend can send.
        // There is no local fallback left, so this would be a permanent blackout.
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse(deviceNow))
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => validResponse })

        await expect(fetchDisplayRate('pln', 'eur')).resolves.toBeCloseTo(0.2322191619648635, 15)
    })

    it('normalizes the pair and converts a valid decimal-string rate to a number', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => validResponse })

        await expect(fetchDisplayRate('pln', 'eur')).resolves.toBeCloseTo(0.2322191619648635, 15)
        expect(mockApiFetch).toHaveBeenCalledWith('/fx/rate?from=PLN&to=EUR', {
            method: 'GET',
            includeAuth: false,
            credentials: 'omit',
            redirect: 'error',
            timeoutMs: 10_000,
        })
    })

    it('returns same-currency identity without depending on the network', async () => {
        await expect(fetchDisplayRate('eur', 'EUR')).resolves.toBe(1)
        expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it.each([
        ['the same provider', 'bridge', 'bridge'],
        ['different providers', 'bridge', 'manteca'],
        ['the other provider', 'manteca', 'manteca'],
    ])('accepts an atomic provider pair using %s', async (_label, fromSource, toSource) => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ...validResponse,
                selection: 'provider_pair',
                fromSource,
                toSource,
                effectiveAt: '2026-08-05T07:00:00.000Z',
            }),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).resolves.toBeCloseTo(0.2322191619648635, 15)
    })

    it('uses per-leg provenance instead of a deprecated aggregate source', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ...validResponse, source: 'mixed' }),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).resolves.toBeCloseTo(0.2322191619648635, 15)
    })

    it.each([
        ['provider pair from USD', 'USD', 'EUR', 'provider_pair', 'identity', 'bridge'],
        ['provider pair to USD', 'PLN', 'USD', 'provider_pair', 'manteca', 'identity'],
        ['reference pair from USD', 'USD', 'PLN', 'reference_pair', 'identity', 'reference'],
        ['reference pair to USD', 'PLN', 'USD', 'reference_pair', 'reference', 'identity'],
    ])(
        'accepts the identity provenance only on the USD leg: %s',
        async (_label, from, to, selection, fromSource, toSource) => {
            mockApiFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    ...validResponse,
                    from,
                    to,
                    selection,
                    fromSource,
                    toSource,
                    effectiveAt: selection === 'provider_pair' ? '2026-08-05T07:00:00.000Z' : validResponse.effectiveAt,
                }),
            })

            await expect(fetchDisplayRate(from, to)).resolves.toBeCloseTo(0.2322191619648635, 15)
        }
    )

    it.each([
        ['numeric rate', { ...validResponse, rate: 0.23 }],
        ['zero rate', { ...validResponse, rate: '0' }],
        ['scientific rate', { ...validResponse, rate: '2.3e-1' }],
        ['leading-zero rate', { ...validResponse, rate: '00.23' }],
        ['over-precise rate', { ...validResponse, rate: '0.1234567890123456789' }],
        ['mismatched pair', { ...validResponse, from: 'USD' }],
        ['wrong basis', { ...validResponse, basis: 'midmarket' }],
        ['non-indicative response', { ...validResponse, indicative: false }],
        ['missing selection', { ...validResponse, selection: undefined }],
        ['unknown selection', { ...validResponse, selection: 'mixed_pair' }],
        ['missing from provenance', { ...validResponse, fromSource: undefined }],
        ['missing to provenance', { ...validResponse, toSource: undefined }],
        ['unknown provenance', { ...validResponse, toSource: 'other' }],
        ['non-canonical timestamp', { ...validResponse, generatedAt: '2026-08-05' }],
        ['missing generation time', { ...validResponse, generatedAt: undefined }],
        // Past the 15-minute freshness bound plus the 6-hour device-clock allowance.
        ['stale generation time', { ...validResponse, generatedAt: '2026-08-05T01:44:59.999Z' }],
        ['future generation time', { ...validResponse, generatedAt: '2026-08-05T14:00:00.001Z' }],
        ['future effective time', { ...validResponse, effectiveAt: '2026-08-05T08:05:00.001Z' }],
        ['stale effective time', { ...validResponse, effectiveAt: '2026-07-06T07:59:59.999Z' }],
        ['implausibly small rate', { ...validResponse, rate: '0.000000000000000000' }],
        ['implausibly large rate', { ...validResponse, rate: '10000000000000000000' }],
        [
            'identity selection on a cross pair',
            {
                ...validResponse,
                rate: '1',
                selection: 'identity',
                fromSource: 'identity',
                toSource: 'identity',
                effectiveAt: null,
            },
        ],
        ['missing effective time on a cross pair', { ...validResponse, effectiveAt: null }],
        ['provider from leg under reference selection', { ...validResponse, fromSource: 'bridge' }],
        ['provider to leg under reference selection', { ...validResponse, toSource: 'manteca' }],
        [
            'reference from leg under provider selection',
            { ...validResponse, selection: 'provider_pair', fromSource: 'reference', toSource: 'bridge' },
        ],
        [
            'reference to leg under provider selection',
            { ...validResponse, selection: 'provider_pair', fromSource: 'bridge', toSource: 'reference' },
        ],
        [
            'identity leg under provider selection',
            { ...validResponse, selection: 'provider_pair', fromSource: 'identity', toSource: 'bridge' },
        ],
        ['identity leg under reference selection', { ...validResponse, fromSource: 'identity' }],
    ])('rejects an unusable backend contract: %s', async (_label, body) => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('invalid rate contract')
    })

    it('applies the shorter provider-observation freshness ceiling', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ...validResponse,
                selection: 'provider_pair',
                fromSource: 'manteca',
                toSource: 'bridge',
                effectiveAt: '2026-08-04T07:59:59.999Z',
            }),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('invalid rate contract')
    })

    it('accepts a reference observation at the provider ceiling because its domain permits 30 days', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ...validResponse, effectiveAt: '2026-08-04T07:59:59.999Z' }),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).resolves.toBeCloseTo(0.2322191619648635, 15)
    })

    it('rejects malformed JSON from the backend', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => Promise.reject(new SyntaxError('bad JSON')),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('invalid JSON')
    })

    it('rejects backend error responses', async () => {
        mockApiFetch.mockResolvedValue({ ok: false, status: 503, headers: new Headers() })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('FX API returned 503')
    })

    it('retains Retry-After on a public rate-limit response', async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 429,
            headers: new Headers({ 'Retry-After': '30' }),
        })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toMatchObject({ status: 429, retryAfter: '30' })
    })

    it('propagates backend transport errors', async () => {
        mockApiFetch.mockRejectedValue(new Error('backend unavailable'))

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('backend unavailable')
    })
})

const liveMarkup = {
    currency: 'ARS',
    markupPct: '0.0536',
    source: 'live',
    indicative: true,
    components: { peanutUsdRate: '1553.5', officialUsdRate: '1520', issuerFeePct: '0.03' },
    effectiveAt: '2026-08-05T07:00:00.000Z',
    generatedAt: '2026-08-05T08:00:00.000Z',
}

const staticMarkup = {
    currency: 'BRL',
    markupPct: '0.07',
    source: 'static',
    indicative: true,
    effectiveAt: null,
    generatedAt: '2026-08-05T08:00:00.000Z',
}

describe('fetchCardMarkup — card comparison contract', () => {
    beforeEach(() => {
        mockApiFetch.mockReset()
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-05T08:00:00.000Z'))
    })

    afterEach(() => jest.restoreAllMocks())

    it('normalizes the currency and reads a live markup', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => liveMarkup })

        await expect(fetchCardMarkup('ars')).resolves.toEqual({ rate: 0.0536, source: 'live' })
        expect(mockApiFetch).toHaveBeenCalledWith('/fx/card-markup?currency=ARS', {
            method: 'GET',
            includeAuth: false,
            credentials: 'omit',
            redirect: 'error',
            timeoutMs: 10_000,
        })
    })

    it('recomputes the markup against a locked price so the saving shown is the saving given', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => liveMarkup })

        // The locked price, not the market one. The issuer fee is charged on
        // top of the converted amount, so the card's effective rate is
        // official / 1.03.
        const result = await fetchCardMarkup('ARS', 1600)
        const { rate, source } = result!

        expect(source).toBe('live')
        expect(rate).toBeCloseTo(1600 / (1520 / 1.03) - 1, 12)
        expect(rate).not.toBeCloseTo(1600 / (1520 * 0.97) - 1, 6)
    })

    it('ignores a locked price on a static answer, which has no components to recompute from', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => staticMarkup })

        await expect(fetchCardMarkup('BRL', 6)).resolves.toEqual({ rate: 0.07, source: 'static' })
    })

    it.each([
        ['a mismatched currency echo', { ...liveMarkup, currency: 'BRL' }],
        ['a non-indicative payload', { ...liveMarkup, indicative: false }],
        ['an exponent-notation markup', { ...liveMarkup, markupPct: '5.36e-2' }],
        ['an implausible markup', { ...liveMarkup, markupPct: '0.9' }],
        ['a live answer with no components', { ...liveMarkup, components: undefined }],
        [
            'a live answer with a zero official rate',
            { ...liveMarkup, components: { ...liveMarkup.components, officialUsdRate: '0' } },
        ],
        ['a stale snapshot', { ...liveMarkup, generatedAt: '2026-08-04T08:00:00.000Z' }],
        ['an unknown source', { ...liveMarkup, source: 'guessed' }],
    ])('rejects %s', async (_label, payload) => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => payload })

        await expect(fetchCardMarkup('ARS')).rejects.toThrow('invalid card-markup contract')
    })

    it('returns null — not a throw — when the backend states there is no gap to show', async () => {
        // A well-formed zero is an answer. Throwing here would let the caller
        // fall back to a static claim on evidence that there is no saving.
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ...staticMarkup, markupPct: '0' }),
        })

        await expect(fetchCardMarkup('BRL')).resolves.toBeNull()
    })

    it('publishes no comparison when a locked price does not beat the card', async () => {
        // The locked price is worse than the card's effective rate, so the real
        // saving is zero or negative. Falling back to the market markup would
        // publish exactly the claim the recompute exists to prevent.
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => liveMarkup })

        await expect(fetchCardMarkup('ARS', 1000)).resolves.toBeNull()
    })

    it('rejects a live answer whose observation is older than the backend allows', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ...liveMarkup, effectiveAt: '2026-07-01T07:00:00.000Z' }),
        })

        await expect(fetchCardMarkup('ARS')).rejects.toThrow('invalid card-markup contract')
    })

    it('throws on a non-200 so the caller can apply its own fallback', async () => {
        mockApiFetch.mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } })

        await expect(fetchCardMarkup('JPY')).rejects.toThrow('FX API returned 404')
    })
})
