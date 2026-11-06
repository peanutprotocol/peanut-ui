/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { ApiError } from '@/services/api-error'

const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } }, fetchUser: mockFetchUser }),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const mockMarkSubmitted = jest.fn()
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: () => mockMarkSubmitted() }))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    openExternalUrl: jest.fn(),
    IN_APP_BROWSER_CLOSED_EVENT: 'peanut:in-app-browser-closed',
}))
const mockCaptureException = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))
const mockStartKyc = jest.fn()
jest.mock('@/services/avenia', () => ({ aveniaApi: { startKyc: (body: unknown) => mockStartKyc(body) } }))

import { useAveniaKycStart } from '../hooks/useAveniaKycStart'

const reservedTab = () => {
    const tab = { opener: {} as unknown, closed: false, close: jest.fn(), location: { href: '' } }
    jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    return tab
}

describe('useAveniaKycStart', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it("opens Avenia's hosted page in the tab reserved by the tap and waits for the rail", async () => {
        const tab = reservedTab()
        mockStartKyc.mockResolvedValue({ state: 'kyc', kycUrl: 'https://kyc.avenia.io/level-1?session=1' })
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))

        await act(async () => {
            await hook.result.current.start()
        })

        // the tap under Avenia's terms is the acceptance the API records
        expect(mockStartKyc).toHaveBeenCalledWith({ termsAccepted: true })
        expect(tab.location.href).toBe('https://kyc.avenia.io/level-1?session=1')
        expect(hook.result.current.isWaiting).toBe(true)
        expect(hook.result.current.error).toBeNull()
        // the user poller runs while the screen waits
        expect(mockMarkSubmitted).toHaveBeenCalled()
    })

    it('closes the tab and refreshes the rail when Avenia already approved the user', async () => {
        const tab = reservedTab()
        mockStartKyc.mockResolvedValue({ state: 'enabled' })
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(tab.close).toHaveBeenCalled()
        expect(mockFetchUser).toHaveBeenCalled()
        expect(hook.result.current.isWaiting).toBe(false)
    })

    it('reads the capabilities again when the route moved since the screen loaded (403)', async () => {
        const tab = reservedTab()
        mockStartKyc.mockRejectedValue(new ApiError('refused', { status: 403, code: 'ROUTE_NOT_AVAILABLE' }))
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(tab.close).toHaveBeenCalled()
        expect(mockFetchUser).toHaveBeenCalled()
        expect(hook.result.current.error).toBeNull()
    })

    it('names a missing CPF and a sub-account still being set up', async () => {
        reservedTab()
        mockStartKyc.mockRejectedValueOnce(new ApiError('cpf', { status: 422, code: 'AVENIA_CPF_REQUIRED' }))
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(hook.result.current.error).toBe('setup.cpfRequired')

        mockStartKyc.mockRejectedValueOnce(new ApiError('busy', { status: 409 }))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(hook.result.current.error).toBe('setup.settingUp')

        mockStartKyc.mockRejectedValueOnce(new ApiError('down', { status: 502, code: 'PROVIDER_UNAVAILABLE' }))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(hook.result.current.error).toBe('unavailable')
        // only the unexplained failure reaches Sentry, tagged for prod-watch
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
        expect(mockCaptureException).toHaveBeenCalledWith(expect.any(ApiError), {
            tags: { critical_flow: 'kyc', kyc_step: 'avenia_launch' },
        })
    })

    it.each([
        ['a body the API refused (400)', new ApiError('body/termsAccepted must be equal to constant', { status: 400 })],
    ])('says the acceptance was not saved on %s, and starts nothing', async (_case, error) => {
        const tab = reservedTab()
        mockStartKyc.mockRejectedValue(error)
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(tab.close).toHaveBeenCalled()
        expect(hook.result.current.error).toBe('setup.termsNotSaved')
        expect(hook.result.current.isWaiting).toBe(false)
    })

    it('opens one tab for two fast taps', async () => {
        reservedTab()
        let resolve: (value: unknown) => void = () => undefined
        mockStartKyc.mockReturnValue(new Promise((r) => (resolve = r)))
        const hook = renderHook(() => useAveniaKycStart({ railEnabled: false }))

        await act(async () => {
            const first = hook.result.current.start()
            const second = hook.result.current.start()
            resolve({ state: 'pending' })
            await Promise.all([first, second])
        })

        expect(mockStartKyc).toHaveBeenCalledTimes(1)
        expect(window.open).toHaveBeenCalledTimes(1)
    })
})
