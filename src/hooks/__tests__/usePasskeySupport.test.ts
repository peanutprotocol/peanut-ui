import { act, waitFor } from '@testing-library/react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { usePasskeySupport } from '../usePasskeySupport'

const mockIsCapacitor = jest.fn()

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsCapacitor() }))

// The AND gate itself lives in harness.consts (tested there). Here we only need
// to drive "is the harness bypass active" — the hook consults it via
// checkPasskeyCapability.
const mockHarnessBypass = jest.fn()
jest.mock('@/constants/harness.consts', () => ({
    HARNESS_ENABLED: false,
    harnessPasskeyBypass: () => mockHarnessBypass(),
}))

const mockBrowserSupportsWebAuthn = jest.mocked(browserSupportsWebAuthn)
const mockPlatformAuthenticatorIsAvailable = jest.mocked(platformAuthenticatorIsAvailable)

describe('usePasskeySupport', () => {
    const originalUserAgent = navigator.userAgent

    beforeEach(() => {
        jest.clearAllMocks()
        mockHarnessBypass.mockReturnValue(false)
        localStorage.removeItem('__harness_skip_passkey')
        mockIsCapacitor.mockReturnValue(false)
        mockBrowserSupportsWebAuthn.mockReturnValue(true)
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(true)
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
        })
    })

    afterAll(() => {
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent })
    })

    /*
     * The QA browser has no platform authenticator, so the probe says no
     * passkeys and /setup walls the run behind the unsupported-browser modal
     * before a scenario reaches its first screen. The harness signs with its
     * own key and needs no authenticator; production sets neither signal.
     */
    it('treats passkeys as available when the harness bypass is active', async () => {
        mockBrowserSupportsWebAuthn.mockReturnValue(false)
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)
        mockHarnessBypass.mockReturnValue(true)

        const { result } = renderHook(() => usePasskeySupport())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(true)
        expect(result.current.browserSupported).toBe(true)
        expect(result.current.error).toBeNull()
        // the real probe is never reached, so a QA browser cannot fail it
        expect(mockPlatformAuthenticatorIsAvailable).not.toHaveBeenCalled()
    })

    it('still refuses a browser with no authenticator once the bypass is gone', async () => {
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)

        const { result } = renderHook(() => usePasskeySupport())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(false)
    })

    it('accepts a secure browser with an available platform authenticator', async () => {
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(true)
        expect(result.current.error).toBeNull()
        expect(mockPlatformAuthenticatorIsAvailable).toHaveBeenCalledTimes(1)
    })

    it('reports that an Android passkey cannot be created when no platform authenticator is available', async () => {
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(false)
        expect(result.current.error).toBe('A platform authenticator is not available')
    })

    it('keeps desktop QR and security-key registration available without a platform authenticator', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
        })
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(true)
        expect(result.current.error).toBeNull()
        expect(mockPlatformAuthenticatorIsAvailable).not.toHaveBeenCalled()
    })

    it.each([
        [
            'iOS Safari',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
        ],
        [
            'iOS Chrome',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
        ],
    ])('keeps a Safari-looking %s environment behind the passkey gate', async (_browser, userAgent) => {
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(false)
        expect(result.current.error).toBe('A platform authenticator is not available')
        expect(mockPlatformAuthenticatorIsAvailable).toHaveBeenCalledTimes(1)
    })

    it('rechecks Android support after returning from device settings', async () => {
        mockPlatformAuthenticatorIsAvailable.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isSupported).toBe(false))

        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        act(() => document.dispatchEvent(new Event('visibilitychange')))

        await waitFor(() => expect(result.current.isSupported).toBe(true))
        expect(mockPlatformAuthenticatorIsAvailable).toHaveBeenCalledTimes(2)
    })

    it('does not confuse missing WebAuthn with optional passkey autofill support', async () => {
        mockBrowserSupportsWebAuthn.mockReturnValue(false)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(false)
        expect(mockPlatformAuthenticatorIsAvailable).not.toHaveBeenCalled()
    })

    it('trusts the native passkey bridge inside Capacitor', async () => {
        mockIsCapacitor.mockReturnValue(true)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(true)
        expect(mockBrowserSupportsWebAuthn).not.toHaveBeenCalled()
    })
})
