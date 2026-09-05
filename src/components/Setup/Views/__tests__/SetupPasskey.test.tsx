import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import SetupPasskey from '../SetupPasskey'

const mockHandleRegister = jest.fn()
const mockApiFetch = jest.fn()

jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleRegister: mockHandleRegister, address: undefined, isRegistering: false }),
}))
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: jest.fn(), isLoggingIn: false }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ isLoading: false, handleNext: jest.fn() }) }))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'Android' }) }))
jest.mock('@/redux/hooks', () => ({ useSetupStore: () => ({ username: 'kim' }) }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/passkeyPreflight', () => ({ checkPasskeySupport: async () => ({ isSupported: true }) }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

describe('SetupPasskey — one tap, one ceremony', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // 404 = username free, so the handler proceeds to registration
        mockApiFetch.mockResolvedValue({ status: 404 })
        mockHandleRegister.mockImplementation(() => new Promise(() => {}))
    })

    /*
     * PEANUT-UI-T09: `isRegistering` only goes true once handleRegister runs,
     * and two awaits precede it (support re-check + username lookup). On a
     * phone that left the button live for a second or more, so every extra tap
     * started its own registration; the losers hit the ceremony guard and
     * showed "Something interrupted the passkey prompt" while the real sheet
     * was still coming up.
     */
    it('ignores taps that land while the pre-ceremony checks are still running', async () => {
        mockApiFetch.mockImplementation(() => new Promise<{ status: number }>(() => {}))

        renderWithIntl(<SetupPasskey />)
        const button = screen.getByRole('button')

        fireEvent.click(button)
        fireEvent.click(button)
        fireEvent.click(button)

        await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
        expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    it('disables the button for the whole handler, not just the ceremony', async () => {
        renderWithIntl(<SetupPasskey />)
        const button = screen.getByRole('button')

        fireEvent.click(button)

        await waitFor(() => expect(button).toBeDisabled())
    })
})
