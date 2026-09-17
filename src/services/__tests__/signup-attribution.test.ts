import { attachSignupAttribution } from '../signup-attribution'

const mockApiFetch = jest.fn()
const mockClearSignupAttribution = jest.fn()
const mockClearPendingSignupAttribution = jest.fn()
const mockHasPendingSignupAttribution = jest.fn()
const mockReadSignupAttributionAsync = jest.fn()
const mockSerializeSignupAttribution = jest.fn()

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))
jest.mock('@/utils/signup-attribution', () => ({
    clearSignupAttribution: (...args: unknown[]) => mockClearSignupAttribution(...args),
    clearPendingSignupAttribution: (...args: unknown[]) => mockClearPendingSignupAttribution(...args),
    hasPendingSignupAttribution: (...args: unknown[]) => mockHasPendingSignupAttribution(...args),
    readSignupAttributionAsync: (...args: unknown[]) => mockReadSignupAttributionAsync(...args),
    serializeSignupAttribution: (...args: unknown[]) => mockSerializeSignupAttribution(...args),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockHasPendingSignupAttribution.mockResolvedValue(true)
    mockReadSignupAttributionAsync.mockResolvedValue({ journeyId: 'journey-1' })
    mockSerializeSignupAttribution.mockReturnValue('{"journeyId":"journey-1"}')
    mockClearPendingSignupAttribution.mockResolvedValue(undefined)
})

describe('signup attribution attachment', () => {
    it('keeps the durable device copy when the API does not acknowledge the write', async () => {
        mockApiFetch.mockResolvedValue({ ok: false, status: 503 })

        await expect(attachSignupAttribution()).rejects.toThrow('signup attribution attach failed: 503')

        expect(mockClearSignupAttribution).not.toHaveBeenCalled()
    })

    it('stops retries but retains the context through signup completion after acknowledgement', async () => {
        mockApiFetch.mockResolvedValue({ ok: true, status: 200 })

        await expect(attachSignupAttribution()).resolves.toBe(true)

        expect(mockApiFetch).toHaveBeenCalledWith('/users/me/signup-attribution', {
            method: 'POST',
            body: JSON.stringify({ attribution: '{"journeyId":"journey-1"}' }),
            redactTelemetry: true,
        })
        expect(mockClearPendingSignupAttribution).toHaveBeenCalledTimes(1)
        expect(mockClearSignupAttribution).not.toHaveBeenCalled()
    })

    it('clears an invalid stored payload without entering a POST retry loop', async () => {
        mockSerializeSignupAttribution.mockReturnValue(null)

        await expect(attachSignupAttribution()).resolves.toBe(false)

        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(mockClearSignupAttribution).toHaveBeenCalledTimes(1)
    })

    it('collapses concurrent registration and auth-provider attempts into one POST', async () => {
        let resolveResponse!: (response: { ok: boolean; status: number }) => void
        mockApiFetch.mockReturnValue(
            new Promise((resolve) => {
                resolveResponse = resolve
            })
        )

        const registrationAttempt = attachSignupAttribution()
        const authProviderAttempt = attachSignupAttribution()
        await Promise.resolve()
        await Promise.resolve()
        expect(mockApiFetch).toHaveBeenCalledTimes(1)

        resolveResponse({ ok: true, status: 200 })

        await expect(Promise.all([registrationAttempt, authProviderAttempt])).resolves.toEqual([true, true])
        expect(mockClearPendingSignupAttribution).toHaveBeenCalledTimes(1)
        expect(mockClearSignupAttribution).not.toHaveBeenCalled()
    })
})
