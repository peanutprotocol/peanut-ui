import { fetchDisplayRate } from '../fx.utils'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.Mock

const validResponse = {
    from: 'PLN',
    to: 'EUR',
    rate: '0.2322191619648635',
    basis: 'display_sell',
    indicative: true,
    source: 'reference',
    effectiveAt: '2026-08-04T00:00:00.000Z',
    generatedAt: '2026-08-05T08:00:00.000Z',
}

describe('fetchDisplayRate — shared backend contract', () => {
    beforeEach(() => {
        mockApiFetch.mockReset()
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-05T08:00:00.000Z'))
    })

    afterEach(() => jest.restoreAllMocks())

    it('normalizes the pair and converts a valid decimal-string rate to a number', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => validResponse })

        await expect(fetchDisplayRate('pln', 'eur')).resolves.toBeCloseTo(0.2322191619648635, 15)
        expect(mockApiFetch).toHaveBeenCalledWith('/fx/rate?from=PLN&to=EUR', { method: 'GET' })
    })

    it('asks the backend to validate same-currency identity pairs', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ...validResponse,
                from: 'EUR',
                to: 'EUR',
                rate: '1',
                source: 'identity',
                effectiveAt: null,
            }),
        })

        await expect(fetchDisplayRate('eur', 'EUR')).resolves.toBe(1)
        expect(mockApiFetch).toHaveBeenCalledWith('/fx/rate?from=EUR&to=EUR', { method: 'GET' })
    })

    it.each([
        ['numeric rate', { ...validResponse, rate: 0.23 }],
        ['zero rate', { ...validResponse, rate: '0' }],
        ['scientific rate', { ...validResponse, rate: '2.3e-1' }],
        ['leading-zero rate', { ...validResponse, rate: '00.23' }],
        ['over-precise rate', { ...validResponse, rate: '0.1234567890123456789' }],
        ['mismatched pair', { ...validResponse, from: 'USD' }],
        ['wrong basis', { ...validResponse, basis: 'midmarket' }],
        ['non-canonical timestamp', { ...validResponse, generatedAt: '2026-08-05' }],
        ['missing generation time', { ...validResponse, generatedAt: undefined }],
        ['stale generation time', { ...validResponse, generatedAt: '2026-08-04T05:59:59.999Z' }],
        ['future generation time', { ...validResponse, generatedAt: '2026-08-05T08:05:00.001Z' }],
        ['future effective time', { ...validResponse, effectiveAt: '2026-08-05T08:05:00.001Z' }],
        ['stale effective time', { ...validResponse, effectiveAt: '2026-07-06T07:59:59.999Z' }],
        ['implausibly small rate', { ...validResponse, rate: '0.0000000000000000001' }],
        ['implausibly large rate', { ...validResponse, rate: '10000000000000000000' }],
        ['identity source on a cross pair', { ...validResponse, source: 'identity', effectiveAt: null }],
        ['missing effective time on a cross pair', { ...validResponse, effectiveAt: null }],
    ])('rejects an unusable backend contract: %s', async (_label, body) => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('invalid rate contract')
    })

    it.each([
        ['non-one rate', { rate: '2' }],
        ['non-identity source', { source: 'reference' }],
        ['non-null effective time', { effectiveAt: '2026-08-04T00:00:00.000Z' }],
    ])('rejects invalid identity cross-fields: %s', async (_label, overrides) => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                ...validResponse,
                from: 'EUR',
                to: 'EUR',
                rate: '1',
                source: 'identity',
                effectiveAt: null,
                ...overrides,
            }),
        })

        await expect(fetchDisplayRate('EUR', 'EUR')).rejects.toThrow('invalid rate contract')
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
        mockApiFetch.mockResolvedValue({ ok: false, status: 503 })

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('FX API returned 503')
    })

    it('propagates backend transport errors', async () => {
        mockApiFetch.mockRejectedValue(new Error('backend unavailable'))

        await expect(fetchDisplayRate('PLN', 'EUR')).rejects.toThrow('backend unavailable')
    })
})
