/** @jest-environment jsdom */
/**
 * applyForCard geo-blocked contract (companion to peanut-api-ts #1586).
 *
 * The backend answers a prohibited residence with HTTP 403 + code
 * 'geo-blocked'. rainRequest throws on any non-ok status, so without the
 * service-level normalization every caller's `status === 'geo-blocked'`
 * branch was unreachable — the user got a retryable applyError instead of
 * the terminal screen. Any other failure must still throw unchanged.
 */
import { rainApi, RainVerificationReverificationError } from '@/services/rain'
import { ApiError } from '@/services/api-error'

const mockFetchWithSentry = jest.fn()
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: (...args: unknown[]) => mockFetchWithSentry(...args),
}))
jest.mock('js-cookie', () => ({ __esModule: true, default: { get: () => 'jwt-abc' } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const jsonResponse = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

describe('Rain first-use re-verification', () => {
    const conflict = {
        code: 'feature_reverification_required',
        userMessage: 'Verify to use your card.',
        message: 'Re-verification required',
        error: 'Re-verification required',
        entry: { kind: 'reverify_for_feature', feature: 'card', targetProvider: 'RAIN', attemptId: null },
    }

    it('returns the typed invitation for a valid 409', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(409, conflict))
        await expect(rainApi.applyForCard()).resolves.toEqual({
            status: 'feature-reverification-required',
            reverification: conflict,
        })
    })

    it('keeps an invalid re-verification payload on the existing error path', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(409, { ...conflict, entry: null }))
        await expect(rainApi.applyForCard()).rejects.toThrow(ApiError)
    })

    it('advertises v3 and preserves the invitation when resuming card verification', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(409, conflict))
        await expect(
            rainApi.resumeVerification('user-1', 'a'.repeat(64), 'generation-1', new AbortController().signal)
        ).rejects.toMatchObject({ reverification: conflict })
        expect(mockFetchWithSentry).toHaveBeenCalledWith(
            expect.stringMatching(/\/rain\/verification\/resume$/),
            expect.objectContaining({ headers: expect.objectContaining({ 'x-kyc-client': '3' }) }),
            10_000
        )
        await expect(
            rainApi.resumeVerification('user-1', 'a'.repeat(64), 'generation-1', new AbortController().signal)
        ).rejects.toBeInstanceOf(RainVerificationReverificationError)
    })
})

describe('rainApi.applyForCard — geo-blocked normalization', () => {
    it("maps 403 code 'geo-blocked' into the union instead of throwing", async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(403, { status: 'error', code: 'geo-blocked', message: 'Not available in your region.' })
        )
        await expect(rainApi.applyForCard()).resolves.toEqual({
            status: 'geo-blocked',
            message: 'Not available in your region.',
        })
    })

    it("maps 403 code 'pending-residence-blocked' into the recoverable union variant", async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(403, {
                status: 'error',
                code: 'pending-residence-blocked',
                message: 'Review your pending residence change.',
            })
        )
        await expect(rainApi.applyForCard()).resolves.toEqual({
            status: 'pending-residence-blocked',
            message: 'Review your pending residence change.',
        })
    })

    // The send gate refused Rain for this user's plan; `reason` names the step the card screen offers.
    it("maps 403 code 'provider-not-in-plan' with its reason into the union", async () => {
        mockFetchWithSentry.mockResolvedValue(
            jsonResponse(403, {
                status: 'error',
                code: 'provider-not-in-plan',
                reason: 'identity_document_insufficient',
                message: 'The card is not part of your current verification.',
            })
        )
        await expect(rainApi.applyForCard()).resolves.toEqual({
            status: 'provider-not-in-plan',
            reason: 'identity_document_insufficient',
            message: 'The card is not part of your current verification.',
        })
    })

    it('still throws for a 403 without the code (old backend / other denial)', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(403, { status: 'error', message: 'nope' }))
        await expect(rainApi.applyForCard()).rejects.toThrow(ApiError)
    })

    it('still throws for a 500', async () => {
        mockFetchWithSentry.mockResolvedValue(jsonResponse(500, { error: 'boom' }))
        await expect(rainApi.applyForCard()).rejects.toThrow()
    })
})
