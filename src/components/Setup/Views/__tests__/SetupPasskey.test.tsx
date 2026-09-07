import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
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
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
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

describe('passkey failure telemetry', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockApiFetch.mockResolvedValue({ status: 404 })
    })
    it.each(['NotAllowedError', 'NotReadableError'])(
        'reports %s once without console or Sentry exception amplification',
        async (name) => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
            mockHandleRegister.mockRejectedValue(Object.assign(new Error('expected passkey outcome'), { name }))
            renderWithIntl(<SetupPasskey />)
            fireEvent.click(screen.getByRole('button'))
            await waitFor(
                () =>
                    expect(posthog.capture).toHaveBeenCalledWith(
                        ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED,
                        expect.objectContaining({ error_name: name })
                    ),
                { timeout: 5000 }
            )
            const failed = (posthog.capture as jest.Mock).mock.calls.filter(
                ([event]) => event === ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED
            )
            expect(failed).toHaveLength(1)
            expect(Sentry.captureException).not.toHaveBeenCalled()
            expect(consoleError).not.toHaveBeenCalled()
            expect(consoleWarn).not.toHaveBeenCalled()
            consoleError.mockRestore()
            consoleWarn.mockRestore()
        }
    )
})

it('reports an unexpected registration failure once without a console-capture duplicate', async () => {
    jest.clearAllMocks()
    mockApiFetch.mockResolvedValue({ status: 404 })
    const error = new Error('unexpected SDK failure')
    mockHandleRegister.mockRejectedValue(error)
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    renderWithIntl(<SetupPasskey />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1))
    expect(
        (posthog.capture as jest.Mock).mock.calls.filter(
            ([event]: [string]) => event === ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED
        )
    ).toHaveLength(1)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
})
