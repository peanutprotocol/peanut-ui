import { waitFor } from '@testing-library/react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { usePasskeySupport } from '../usePasskeySupport'

const mockIsCapacitor = jest.fn()

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsCapacitor() }))

const mockBrowserSupportsWebAuthn = jest.mocked(browserSupportsWebAuthn)
const mockPlatformAuthenticatorIsAvailable = jest.mocked(platformAuthenticatorIsAvailable)

describe('usePasskeySupport', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
        mockBrowserSupportsWebAuthn.mockReturnValue(true)
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(true)
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    })

    it('accepts a secure browser with an available platform authenticator', async () => {
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(true)
        expect(result.current.error).toBeNull()
        expect(mockPlatformAuthenticatorIsAvailable).toHaveBeenCalledTimes(1)
    })

    it('reports that a passkey cannot be created when no platform authenticator is available', async () => {
        mockPlatformAuthenticatorIsAvailable.mockResolvedValue(false)
        const { result } = renderHook(() => usePasskeySupport())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.isSupported).toBe(false)
        expect(result.current.error).toBe('A platform authenticator is not available')
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
