/** @jest-environment jsdom */
/**
 * Withdraw-submit error handling for the stale-card-approval case
 * (companion to peanut-api-ts #1143).
 *
 * A 409 whose body carries `code: 'STALE_CARD_APPROVAL'` must throw the typed
 * `StaleCardApprovalError` AND dispatch `RAIN_STALE_APPROVAL_EVENT` so the
 * global re-enable modal can surface the recovery CTA. Every other failure
 * (a plain 409, a 500, a network error) must fall through to the existing
 * generic `Error` unchanged.
 */
import { rainApi, StaleCardApprovalError, RAIN_STALE_APPROVAL_EVENT } from '@/services/rain'

const mockFetchWithSentry = jest.fn()
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: (...args: unknown[]) => mockFetchWithSentry(...args),
}))
jest.mock('js-cookie', () => ({ __esModule: true, default: { get: () => 'jwt-abc' } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const withdrawInput = {
    preparationId: 'prep-1',
    amount: '1000000',
    recipientAddress: '0xrecipient',
    directTransfer: true,
    adminSalt: '0xsalt',
    adminNonce: '1',
    adminSignature: '0xsig',
    executorSignature: '0xexec',
    executorSalt: '0xexecsalt',
    expiresAt: 1893456000,
}

const jsonResponse = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

describe('rainApi.submitWithdrawal — stale card approval', () => {
    it('throws StaleCardApprovalError and dispatches the re-enable event on 409 STALE_CARD_APPROVAL', async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(409, { error: 'Your card needs to be re-enabled.', code: 'STALE_CARD_APPROVAL' })
        )
        const onEvent = jest.fn()
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)

        await expect(rainApi.submitWithdrawal(withdrawInput)).rejects.toBeInstanceOf(StaleCardApprovalError)
        expect(onEvent).toHaveBeenCalledTimes(1)

        window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)
    })

    it('surfaces the backend copy verbatim on the typed error', async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(409, { error: 'Your card needs to be re-enabled.', code: 'STALE_CARD_APPROVAL' })
        )
        await expect(rainApi.submitWithdrawal(withdrawInput)).rejects.toThrow('Your card needs to be re-enabled.')
    })

    it('a 409 WITHOUT the code falls through to a generic Error and fires no event', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(409, { error: 'Charge already paid' }))
        const onEvent = jest.fn()
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)

        const err = await rainApi.submitWithdrawal(withdrawInput).catch((e) => e)
        expect(err).toBeInstanceOf(Error)
        expect(err).not.toBeInstanceOf(StaleCardApprovalError)
        expect(err.message).toBe('Charge already paid')
        expect(onEvent).not.toHaveBeenCalled()

        window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)
    })

    it('session-approve 400 STALE_CARD_APPROVAL is typed but fires NO re-enable event (no modal loop)', async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(400, {
                error: 'This approval targets an outdated card contract.',
                code: 'STALE_CARD_APPROVAL',
            })
        )
        const onEvent = jest.fn()
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)

        const err = await rainApi.submitWithdrawSessionApproval({ serializedApproval: 'blob' }).catch((e) => e)
        expect(err).toBeInstanceOf(StaleCardApprovalError)
        expect(err.message).toBe('This approval targets an outdated card contract.')
        expect(onEvent).not.toHaveBeenCalled()

        window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)
    })

    it('a session-approve 400 WITHOUT the code stays a generic error', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(400, { error: 'Invalid approval — could not deserialize' }))
        const err = await rainApi.submitWithdrawSessionApproval({ serializedApproval: 'blob' }).catch((e) => e)
        expect(err).not.toBeInstanceOf(StaleCardApprovalError)
        expect(err.message).toBe('Invalid approval — could not deserialize')
    })

    /**
     * The cache-repair endpoint (TASK-22734) must stay inert UI-wise: it can
     * be called from any failed Rain leg, so it must never be the thing that
     * pops the global re-enable modal.
     */
    it('refreshControllerAddress posts an empty body and returns the cache state', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(200, { coordinatorAddress: '0xnew', changed: true }))

        await expect(rainApi.refreshControllerAddress()).resolves.toEqual({
            coordinatorAddress: '0xnew',
            changed: true,
        })
        const [url, init] = mockFetchWithSentry.mock.calls[0]
        expect(url).toContain('/rain/cards/controller/refresh')
        expect(init).toMatchObject({ method: 'POST', body: '{}' })
    })

    it('a failing refresh is a plain error and fires NO re-enable event', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(502, { error: 'Rain contracts unavailable' }))
        const onEvent = jest.fn()
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)

        const err = await rainApi.refreshControllerAddress().catch((e) => e)
        expect(err).toBeInstanceOf(Error)
        expect(err).not.toBeInstanceOf(StaleCardApprovalError)
        expect(err.message).toBe('Rain contracts unavailable')
        expect(onEvent).not.toHaveBeenCalled()

        window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)
    })

    it('a non-409 failure is unchanged (generic Error, no event)', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(500, { error: 'boom' }))
        const onEvent = jest.fn()
        window.addEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)

        const err = await rainApi.submitWithdrawal(withdrawInput).catch((e) => e)
        expect(err).toBeInstanceOf(Error)
        expect(err).not.toBeInstanceOf(StaleCardApprovalError)
        expect(onEvent).not.toHaveBeenCalled()

        window.removeEventListener(RAIN_STALE_APPROVAL_EVENT, onEvent)
    })
})
