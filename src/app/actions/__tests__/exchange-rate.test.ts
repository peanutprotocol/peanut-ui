import { AccountType } from '@/interfaces/interfaces'
import { getExchangeRate } from '../exchange-rate'

const serverFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => serverFetch(...args) }))

const jsonResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
})
const textResponse = (status: number) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
})

beforeEach(() => {
    serverFetch.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('getExchangeRate', () => {
    it('lets the caller own failure reporting for the request', async () => {
        serverFetch.mockResolvedValue(jsonResponse(200, { buy_rate: '0.92', sell_rate: '0.9' }))
        await expect(getExchangeRate(AccountType.IBAN, { callerReportsFailures: true })).resolves.toEqual({
            data: { buy_rate: '0.92', sell_rate: '0.9' },
        })
        expect(serverFetch).toHaveBeenCalledWith('/bridge/exchange-rate?accountType=iban', {
            method: 'GET',
            callerReportsFailures: true,
        })
    })

    it('returns the HTTP status of a failed response', async () => {
        serverFetch.mockResolvedValue(jsonResponse(503, { error: 'Failed to fetch exchange rate.' }))
        await expect(getExchangeRate(AccountType.IBAN)).resolves.toEqual({
            error: 'Failed to fetch exchange rate.',
            status: 503,
            failure: 'http',
        })
    })

    it('keeps the status when an edge error page is not JSON', async () => {
        serverFetch.mockResolvedValue(textResponse(502))
        await expect(getExchangeRate(AccountType.CLABE)).resolves.toMatchObject({ status: 502, failure: 'http' })
    })

    it('reports an unreadable success body as an invalid rate', async () => {
        serverFetch.mockResolvedValue(textResponse(200))
        await expect(getExchangeRate(AccountType.GB)).resolves.toMatchObject({ status: 200, failure: 'invalid_rate' })
    })

    it.each([
        ['ConnectionTimeoutError', 'timeout'],
        ['ServiceUnavailableError', 'network'],
    ])('classifies a %s transport failure as %s', async (name, failure) => {
        serverFetch.mockRejectedValue(Object.assign(new Error('transport'), { name }))
        await expect(getExchangeRate(AccountType.IBAN)).resolves.toEqual({ error: 'transport', failure })
    })
})
