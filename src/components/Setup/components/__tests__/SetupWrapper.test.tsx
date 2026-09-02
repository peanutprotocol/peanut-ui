/** @jest-environment jsdom */
/**
 * Setup chrome: the back chevron must inherit currentColor (the stroke button
 * inverts on hover/active, and a hard-coded black stroke vanished into it), and
 * pre-auth steps expose Log In next to Skip so a returning user routed past the
 * landing step can still reach the passkey ceremony.
 */
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SetupWrapper } from '../SetupWrapper'

const mockHandleLoginClick = jest.fn(() => Promise.resolve())
let mockIsLoggingIn = false
jest.mock('@/hooks/useLogin', () => ({
    useLogin: () => ({ handleLoginClick: mockHandleLoginClick, isLoggingIn: mockIsLoggingIn }),
}))

const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))

jest.mock('@/hooks/useBravePWAInstallState', () => ({ useBravePWAInstallState: () => ({ isBrave: false }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isCapacitor: () => false }))
jest.mock('@/utils/webauthn.utils', () => ({ isAlreadyReported: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/Views/InstallPWA', () => ({ __esModule: true, default: () => null }))
jest.mock('framer-motion', () => ({
    useReducedMotion: () => true,
    motion: {
        div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
            <div className={className}>{children}</div>
        ),
    },
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const mockedCapture = posthog.capture as jest.Mock

function renderWrapper(props: Partial<React.ComponentProps<typeof SetupWrapper>> = {}) {
    return renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="signup" title="Pick a handle" {...props}>
            <div data-testid="step" />
        </SetupWrapper>
    )
}

describe('SetupWrapper navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsLoggingIn = false
    })

    it('renders the back chevron without a hard-coded stroke colour', () => {
        renderWrapper({ showBackButton: true, onBack: jest.fn() })
        const svg = screen.getByRole('button', { name: 'Go back' }).querySelector('svg')
        expect(svg).not.toBeNull()
        expect(svg).not.toHaveAttribute('stroke', 'black')
        expect(svg).toHaveAttribute('stroke', 'currentColor')
    })

    it('fires onBack from the back button', () => {
        const onBack = jest.fn()
        renderWrapper({ showBackButton: true, onBack })
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
        expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('hides Log In unless the step asks for it', () => {
        renderWrapper({ showBackButton: true })
        expect(screen.queryByRole('button', { name: 'Log In' })).not.toBeInTheDocument()
    })

    it('shows Log In next to Skip and runs the login ceremony', async () => {
        renderWrapper({ showLoginButton: true, showSkipButton: true, onSkip: jest.fn() })
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log In' }))
        await waitFor(() => expect(mockHandleLoginClick).toHaveBeenCalledTimes(1))
        expect(mockToastError).not.toHaveBeenCalled()
    })

    it('shows Log In on its own when the step has no Skip or Back', () => {
        renderWrapper({ showLoginButton: true })
        expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    })

    it('disables Log In while the ceremony is running', () => {
        mockIsLoggingIn = true
        renderWrapper({ showLoginButton: true })
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('surfaces a failed login as a toast and an analytics event', async () => {
        const failure = Object.assign(new Error('No passkey found'), { code: 'NO_PASSKEY' })
        mockHandleLoginClick.mockRejectedValueOnce(failure)
        renderWrapper({ showLoginButton: true })
        fireEvent.click(screen.getByRole('button', { name: 'Log In' }))
        await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('No passkey found'))
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, { error_code: 'NO_PASSKEY' })
    })
})
