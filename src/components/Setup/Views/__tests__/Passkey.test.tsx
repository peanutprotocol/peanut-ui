/** @jest-environment jsdom */
import { act, fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import PasskeyStep from '../Passkey'

const mockSetScreenId = jest.fn()
const mockSetRefusedUsername = jest.fn()
const mockReserveUsername = jest.fn()
const mockClaim = jest.fn(async () => {})
const mockPasskey = {
    claim: mockClaim,
    isClaiming: false,
    preflightWarning: null as string | null,
    inlineError: null as string | null,
    usernameTaken: false,
    logIn: jest.fn(),
    isLoggingIn: false,
    helpErrorName: null as string | null,
    isHelpOpen: false,
    closeHelp: jest.fn(),
    retryFromHelp: jest.fn(),
    isProviderUnsupportedOpen: false,
    providerUnsupportedPlatform: 'android-app',
    browserOpenFailed: false,
    closeProviderUnsupported: jest.fn(),
    retryFromProviderUnsupported: jest.fn(),
    signUpInBrowser: jest.fn(),
    deviceType: 'web',
}
const mockUseSignupPasskey = jest.fn((_username: string) => mockPasskey)

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ isLoading: false, setScreenId: mockSetScreenId }),
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ username: 'newuser', setRefusedUsername: mockSetRefusedUsername }),
    useOptionalSetupFlow: () => null,
}))
jest.mock('@/features/setup/useSignupPasskey', () => ({
    useSignupPasskey: (username: string) => mockUseSignupPasskey(username),
}))
jest.mock('@/features/setup/username-reservation', () => ({
    reserveUsername: (username: string) => mockReserveUsername(username),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const renderPasskey = () => renderWithIntl(onSignupScreen('passkey', <PasskeyStep />))

beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(mockPasskey, {
        isClaiming: false,
        preflightWarning: null,
        inlineError: null,
        usernameTaken: false,
        isLoggingIn: false,
        helpErrorName: null,
        isHelpOpen: false,
        isProviderUnsupportedOpen: false,
    })
    mockReserveUsername.mockResolvedValue('reserved')
})

describe('Create passkey', () => {
    it.each(['taken', 'refused', 'invalid'])(
        'reports a mount reservation %s before returning to Claim',
        async (result) => {
            mockReserveUsername.mockResolvedValue(result)
            renderPasskey()
            await act(async () => {})
            expect(mockSetScreenId).toHaveBeenCalledWith('signup')
            expect(signupControls(posthog.capture as jest.Mock)).toEqual([`username:error:${result}`])
            expect(mockClaim).not.toHaveBeenCalled()
            expect(mockSetRefusedUsername).toHaveBeenCalledTimes(result === 'refused' ? 1 : 0)
        }
    )
    it('opens the passkey ceremony directly and refreshes the reserved username on mount', () => {
        renderPasskey()
        expect(mockReserveUsername).toHaveBeenCalledWith('newuser')
        expect(mockUseSignupPasskey).toHaveBeenLastCalledWith('newuser')
        fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }))
        expect(mockClaim).toHaveBeenCalledTimes(1)
        expect(signupControls(posthog.capture as jest.Mock)).toEqual(['create_passkey:tap'])
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('stays disabled while passkey registration runs', () => {
        mockPasskey.isClaiming = true
        renderPasskey()
        expect(screen.getByRole('button', { name: /Create passkey$/ })).toBeDisabled()
    })

    it('offers Log in when the username is already registered', () => {
        mockPasskey.usernameTaken = true
        renderPasskey()
        expect(screen.getByText(/This username isn’t available right now/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(mockPasskey.logIn).toHaveBeenCalledTimes(1)
    })

    it('shows the passkey failure message on the step', () => {
        mockPasskey.inlineError = 'Passkey verification wasn’t completed. Try again when ready.'
        renderPasskey()
        expect(screen.getByText('Passkey verification wasn’t completed. Try again when ready.')).toBeInTheDocument()
    })
})

describe('Create passkey — control analytics', () => {
    const controls = () => signupControls(posthog.capture as jest.Mock)

    it('reports Log in for a taken username and the passkey help drawer actions', () => {
        Object.assign(mockPasskey, { usernameTaken: true, helpErrorName: 'NotAllowedError', isHelpOpen: true })
        renderPasskey()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        fireEvent.click(screen.getByRole('link', { name: 'Still stuck?' }))
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        fireEvent.click(screen.getByRole('button', { name: 'Log in', hidden: true }))
        expect(controls()).toEqual([
            'passkey_help:open',
            'passkey_help_retry:tap',
            'passkey_help_support:tap',
            'passkey_help:dismiss',
            'log_in:tap',
        ])
        expect(mockPasskey.retryFromHelp).toHaveBeenCalledTimes(1)
        expect(mockPasskey.closeHelp).toHaveBeenCalledTimes(1)
        expect(mockPasskey.logIn).toHaveBeenCalledTimes(1)
    })

    it('reports help visibility once per opening, including after closing and reopening', () => {
        Object.assign(mockPasskey, { helpErrorName: 'NotAllowedError', isHelpOpen: true })
        const view = renderPasskey()
        view.rerender(onSignupScreen('passkey', <PasskeyStep />))
        expect(controls()).toEqual(['passkey_help:open'])
        mockPasskey.isHelpOpen = false
        view.rerender(onSignupScreen('passkey', <PasskeyStep />))
        mockPasskey.isHelpOpen = true
        view.rerender(onSignupScreen('passkey', <PasskeyStep />))
        expect(controls()).toEqual(['passkey_help:open', 'passkey_help:open'])
    })

    it('reports the unsupported-provider drawer actions (TASK-24498)', () => {
        Object.assign(mockPasskey, { isProviderUnsupportedOpen: true })
        renderPasskey()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        fireEvent.click(screen.getByRole('button', { name: 'Sign up at peanut.me in a browser' }))
        fireEvent.click(screen.getByRole('link', { name: 'Still stuck?' }))
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        expect(controls()).toEqual([
            'passkey_provider_retry:tap',
            'passkey_provider_web_signup:tap',
            'passkey_provider_support:tap',
            'passkey_provider:dismiss',
        ])
        expect(mockPasskey.retryFromProviderUnsupported).toHaveBeenCalledTimes(1)
        expect(mockPasskey.signUpInBrowser).toHaveBeenCalledTimes(1)
        expect(mockPasskey.closeProviderUnsupported).toHaveBeenCalledTimes(1)
    })
})

it('ignores an obsolete mount collision once passkey registration is running', async () => {
    let resolve!: (value: string) => void
    mockReserveUsername.mockReturnValue(
        new Promise((done) => {
            resolve = done
        })
    )
    const view = renderPasskey()
    mockPasskey.isClaiming = true
    view.rerender(onSignupScreen('passkey', <PasskeyStep />))
    await act(async () => resolve('taken'))
    expect(mockSetScreenId).not.toHaveBeenCalled()
})
