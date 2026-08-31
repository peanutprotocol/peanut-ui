/** @jest-environment jsdom */
/**
 * Both withdraw calls flattened every throw into `{ error }`, including
 * serverFetch's transport failures. The page's `if (result.error)` branch then
 * returned before its catch ran, so the network-triage capture this flow
 * depends on never fired for the failure class it exists to record
 * (TASK-21956) — the money leg of an offramp dying over a dead network left no
 * queryable Sentry event at all.
 *
 * These reject serverFetch itself rather than mocking the service, because the
 * bug lived in the service's own catch: a test stubbing mantecaApi would have
 * passed against the broken code.
 */
import { mantecaApi } from '@/services/manteca'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

function transportError(name: string): Error {
    const e = new Error('Service temporarily unavailable')
    e.name = name
    return e
}

const withdrawBody = {
    kind: 'rainWithdrawal' as const,
    priceLockCode: 'lock-1',
    amount: '10',
    destinationAddress: '0xabc',
    currency: 'ARS',
    signedRainWithdrawal: {} as never,
    chainId: '8453',
}

const initBody = { amount: '10', currency: 'ARS', country: 'AR' } as never

beforeEach(() => jest.clearAllMocks())

describe('manteca withdraw transport failures', () => {
    it.each(['ServiceUnavailableError', 'ConnectionTimeoutError'])(
        'rethrows %s from the submit call so the page can triage it',
        async (name) => {
            mockServerFetch.mockRejectedValue(transportError(name))
            await expect(mantecaApi.withdrawWithSignedTx(withdrawBody)).rejects.toMatchObject({ name })
        }
    )

    it.each(['ServiceUnavailableError', 'ConnectionTimeoutError'])(
        'rethrows %s from the lock-rate call so the page can triage it',
        async (name) => {
            mockServerFetch.mockRejectedValue(transportError(name))
            await expect(mantecaApi.initiateWithdraw(initBody)).rejects.toMatchObject({ name })
        }
    )

    it('rethrows a native WebView fetch rejection, the Android failure shape', async () => {
        mockServerFetch.mockRejectedValue(new TypeError('Load failed'))
        await expect(mantecaApi.withdrawWithSignedTx(withdrawBody)).rejects.toBeInstanceOf(TypeError)
    })

    it('still flattens a non-transport error, so deliberate error copy is unaffected', async () => {
        mockServerFetch.mockRejectedValue(new Error('CUIT_MISMATCH'))
        await expect(mantecaApi.withdrawWithSignedTx(withdrawBody)).resolves.toEqual({ error: 'CUIT_MISMATCH' })
    })

    it('still returns the server error body on a non-ok response', async () => {
        mockServerFetch.mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'TAX_ID_MISMATCH', message: 'nope' }),
        } as Response)
        await expect(mantecaApi.withdrawWithSignedTx(withdrawBody)).resolves.toEqual({
            error: 'TAX_ID_MISMATCH',
            message: 'nope',
        })
    })
})
