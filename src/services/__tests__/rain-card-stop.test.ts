/** @jest-environment jsdom */
/**
 * Lock and cancel wire contract (companion to peanut-api-ts #2096, TASK-24511).
 *
 * A cancel that waits for the card balance answers 409 with a code and
 * `retryAfterSec`; the modal's countdown reads both off the thrown error. A
 * lock is never refused for the return and reports it in `collateralReturn`.
 * A backend that predates the change sends neither, and nothing is invented.
 */
import { rainApi } from '@/services/rain'
import { ApiError } from '@/services/api-error'

const mockFetchWithSentry = jest.fn()
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: (...args: unknown[]) => mockFetchWithSentry(...args),
}))
jest.mock('js-cookie', () => ({ __esModule: true, default: { get: () => 'jwt-abc' } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const jsonResponse = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const refusedCancel = async (status: number, body: unknown): Promise<ApiError> => {
    mockFetchWithSentry.mockResolvedValue(jsonResponse(status, body))
    const error = await rainApi.cancelCard('card-1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    return error as ApiError
}

beforeEach(() => jest.clearAllMocks())

describe('rainApi.cancelCard: a cancel that waits for the card balance', () => {
    it.each(['CARD_RETURN_BLOCKED', 'CARD_BALANCE_REMAINS'])('%s carries the code and the wait', async (code) => {
        const error = await refusedCancel(409, { error: 'Try again in 3 minutes.', code, retryAfterSec: 163 })
        expect(error).toMatchObject({ status: 409, code, retryAfterSec: 163 })
    })

    it('CARD_BALANCE_UNREADABLE carries the code and no wait', async () => {
        const error = await refusedCancel(502, { error: 'Could not read', code: 'CARD_BALANCE_UNREADABLE' })
        expect(error).toMatchObject({ status: 502, code: 'CARD_BALANCE_UNREADABLE' })
        expect(error.retryAfterSec).toBeUndefined()
    })

    it.each([0, -5, '163', null])('a wait of %p is not a wait', async (retryAfterSec) => {
        const error = await refusedCancel(409, { error: 'wait', code: 'CARD_RETURN_BLOCKED', retryAfterSec })
        expect(error.retryAfterSec).toBeUndefined()
    })

    it('a backend that predates the codes still throws its own sentence', async () => {
        const error = await refusedCancel(400, {
            error: 'Withdrawal signature required to return collateral before this action',
        })
        expect(error.message).toBe('Withdrawal signature required to return collateral before this action')
        expect(error.code).toBeUndefined()
        expect(error.retryAfterSec).toBeUndefined()
    })
})

describe('rainApi.lockCard: what the freeze left in the card', () => {
    const fundingStop = { state: 'not_applicable', reason: null }

    it('hands `collateralReturn` through untouched', async () => {
        const collateralReturn = {
            state: 'waiting',
            returnedCents: 0,
            remainingCents: 2000,
            heldCents: 550,
            cardCreditCents: 0,
            retryAfterSec: 420,
        }
        mockFetchWithSentry.mockResolvedValue(jsonResponse(200, { status: 'LOCKED', fundingStop, collateralReturn }))
        await expect(rainApi.lockCard('card-1')).resolves.toEqual({ status: 'LOCKED', fundingStop, collateralReturn })
    })

    it('a backend that predates the field answers without it', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(200, { status: 'LOCKED', fundingStop }))
        const locked = await rainApi.lockCard('card-1')
        expect(locked.collateralReturn).toBeUndefined()
    })
})
