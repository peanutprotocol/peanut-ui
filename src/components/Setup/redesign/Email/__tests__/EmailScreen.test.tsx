/** @jest-environment jsdom */
/**
 * 09 Email (`notification-email`), contract P4 § 2. Written from the contract before the screen exists; the
 * still-valid cases of dev's Email.test.tsx and NotificationSetup.test.tsx are ported here against the new copy.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import { type ReactNode, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { USER } from '@/constants/query.consts'
import { signupControls } from '@/test-utils/signup-controls'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'
import { addBreadcrumb, captureException } from '@/utils/sentry-lazy'
import { reportEmailSaveFailure } from '@/features/setup/report-email-save-failure'
import { EmailScreen } from '../EmailScreen'
import {
    copy,
    copyRx,
    footer,
    renderRedesign,
    setupState,
    textMatch,
    visibleText,
    type FlowSeed,
} from '../../Accounts/__tests__/redesignHarness'

const mockUpdateUser = jest.fn()
const mockNext = jest.fn()
const mockFetchUser = jest.fn(async () => {})
let mockUser: { user: { userId?: string; email: string | null } } | null
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: () => ({ addEventListener: jest.fn(), destroy: jest.fn(), goToAndStop: jest.fn() }) },
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext, isLoading: false }) }))
const mockLogin = jest.fn(async () => {})
jest.mock('@/hooks/useLogin', () => ({ useLogin: () => ({ handleLoginClick: mockLogin, isLoggingIn: false }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('@/features/setup/report-email-save-failure', () => ({ reportEmailSaveFailure: jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }),
    useOptionalAuth: () => ({ user: mockUser }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))

const capture = posthog.capture as jest.Mock
const controls = () => signupControls(capture)
let queryClient: QueryClient
let urlUpdates: UrlUpdateEvent[]

const render = (
    opts: { seed?: FlowSeed; locale?: 'en' | 'es-AR'; showBackButton?: boolean; onBack?: () => void } = {}
) => {
    const wrap = (node: ReactNode) => (
        <NuqsTestingAdapter onUrlUpdate={(event) => urlUpdates.push(event)}>
            <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
        </NuqsTestingAdapter>
    )
    return renderRedesign(wrap(<EmailScreen />), {
        screenId: 'notification-email',
        seed: opts.seed,
        locale: opts.locale,
        showBackButton: opts.showBackButton,
        onBack: opts.onBack,
    })
}

const field = () => screen.getByRole('textbox', { name: copyRx('setupRedesign.email.label') })
/** The shell's primary button (its accessible name gains "Loading..." while it spins). */
const primary = (container: HTMLElement) => within(footer(container)!).getAllByRole('button')[0]
const continueButton = (container: HTMLElement) =>
    within(footer(container)!).getByRole('button', { name: copyRx('setupRedesign.common.continue') })
/** The text of the elements the field's aria-describedby points at. */
const describedText = () =>
    (field().getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .map((id) => visibleText(id ? document.getElementById(id) : null))
        .join(' ')
const validCheck = () => screen.queryByTestId('setup-redesign-email-valid')
const type = (value: string) => fireEvent.change(field(), { target: { value } })

beforeEach(() => {
    jest.clearAllMocks()
    resetBackHandlersForTests()
    mockUpdateUser.mockReset().mockResolvedValue({})
    mockNext.mockReset().mockResolvedValue(undefined)
    mockFetchUser.mockReset().mockResolvedValue(undefined)
    mockLogin.mockReset().mockResolvedValue(undefined)
    mockUser = { user: { userId: 'new-user', email: '' } }
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    urlUpdates = []
})

describe('09 Email', () => {
    it('P4-02 after registration Email shows no back button and a hardware back leaves it in place', () => {
        // the page passes showBackButton=false on the lock step (noBackLockScreenId = notification-email)
        const { container } = render({ showBackButton: false })
        expect(screen.queryByRole('button', { name: copyRx('setup.navigation.goBack') })).not.toBeInTheDocument()
        act(() => {
            dispatchBackPress()
        })
        expect(field()).toBeInTheDocument()
        expect(setupState(container)).toBe('default')
    })

    it('P4-04 empty start: default state, empty field with the Email placeholder, label as its name, Continue off', () => {
        const { container } = render()
        expect(screen.getByTestId('setup-redesign-email')).toBeInTheDocument()
        expect(setupState(container)).toBe('default')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.email.title'))
        expect(screen.getByText(textMatch(copy('setupRedesign.email.desc')))).toBeInTheDocument()
        expect(field()).toHaveValue('')
        expect(field()).toHaveAttribute('placeholder', copy('setupRedesign.email.placeholder'))
        expect(continueButton(container)).toBeDisabled()
        // the note sits under the button
        expect(within(footer(container)!).getByText(textMatch(copy('setupRedesign.email.note')))).toBeInTheDocument()
    })

    it('P4-05 prefills the account email (Continue on), and a draft wins over it', () => {
        mockUser = { user: { userId: 'new-user', email: 'a@b.co' } }
        const first = render()
        expect(field()).toHaveValue('a@b.co')
        expect(continueButton(first.container)).toBeEnabled()
        expect(setupState(first.container)).toBe('filled')
        first.unmount()
        render({ seed: { notificationEmail: 'draft@b.co' } })
        expect(field()).toHaveValue('draft@b.co')
    })

    it('P4-06 an invalid address shows the error on blur, marks the field invalid, keeps Continue off, reports once', () => {
        const { container } = render()
        type('abc')
        fireEvent.blur(field())
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(copyRx('setupRedesign.email.invalid'))
        expect(field()).toHaveAttribute('aria-invalid', 'true')
        expect(describedText()).toContain(copy('setupRedesign.email.invalid'))
        expect(alert).toBeInTheDocument()
        expect(setupState(container)).toBe('invalid')
        expect(continueButton(container)).toBeDisabled()
        fireEvent.focus(field())
        fireEvent.blur(field())
        expect(controls().filter((c) => c === 'email:error:invalid')).toHaveLength(1)
    })

    it('P4-07 a@b.c is valid by the app’s isValidEmail: Continue on and the green check shows', () => {
        const { container } = render()
        type('a@b.c')
        fireEvent.blur(field())
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(continueButton(container)).toBeEnabled()
        expect(validCheck()).toBeInTheDocument()
        expect(setupState(container)).toBe('filled')
    })

    it('P4-08 the field is an email input with autocomplete, input mode and max length, disabled while saving', async () => {
        mockUpdateUser.mockReturnValue(new Promise(() => undefined))
        const { container } = render()
        expect(field()).toHaveAttribute('type', 'email')
        expect(field()).toHaveAttribute('autocomplete', 'email')
        expect(field()).toHaveAttribute('inputmode', 'email')
        expect(field()).toHaveAttribute('maxlength', '254')
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(field()).toBeDisabled())
        expect(setupState(container)).toBe('saving')
        expect(primary(container)).toBeDisabled()
    })

    it('P4-09 Continue trims and saves once; a second tap during the save sends nothing', async () => {
        let finish!: (value: unknown) => void
        mockUpdateUser.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
        const view = render()
        type('  New@Mail.com ')
        fireEvent.click(continueButton(view.container))
        fireEvent.click(primary(view.container))
        fireEvent.submit(field().closest('form') ?? field())
        expect(mockUpdateUser).toHaveBeenCalledTimes(1)
        expect(mockUpdateUser).toHaveBeenCalledWith({ userId: 'new-user', email: 'New@Mail.com' })
        // the draft holds the trimmed address before the request lands
        expect(view.flow().notificationEmail).toBe('New@Mail.com')
        expect(mockNext).not.toHaveBeenCalled()
        await act(async () => finish({}))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    })

    it('P4-10 the account’s own email in another case advances with no request', async () => {
        mockUser = { user: { userId: 'new-user', email: 'Me@Mail.com' } }
        const { container } = render()
        type('me@mail.com')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).not.toHaveBeenCalled()
    })

    it('P4-11 EMAIL_ON_ACTIVE_ACCOUNT: already-registered with "Log in to that account" first, then the recovery link', async () => {
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'whatever' })
        const { container } = render()
        type('taken@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.taken'))
        expect(setupState(container)).toBe('already-registered')
        expect(field()).toHaveAttribute('aria-invalid', 'true')
        const foot = within(footer(container)!)
        // the primary's label crossfades in 100 ms
        expect(await foot.findByRole('button', { name: copyRx('setupRedesign.email.logIn') })).toBeEnabled()
        expect(foot.queryByRole('button', { name: copyRx('setupRedesign.common.continue') })).not.toBeInTheDocument()
        expect(foot.getByText(copyRx('setupRedesign.email.recover'))).toBeInTheDocument()
        expect(controls()).toContain('email:error:already_registered')
        expect(addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Sign-up email already registered' })
        )
        expect(reportEmailSaveFailure).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('P4-12 "Log in to that account" opens the passkey login; a cancel stays quiet; the recovery link opens the doc', async () => {
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'x' })
        const { container } = render()
        type('taken@mail.com')
        fireEvent.click(continueButton(container))
        await screen.findByRole('alert')
        const recover = within(footer(container)!).getByText(copyRx('setupRedesign.email.recover'))
        const link = recover.closest('a,button') as HTMLElement
        if (link.tagName === 'A') expect(link.getAttribute('href')).toMatch(/\/help\/account-recovery$/)
        fireEvent.click(link)
        expect(controls()).toContain('account-recovery_doc:open')
        // support shows only once a login attempt failed
        expect(screen.queryByRole('link', { name: /contact support/i })).not.toBeInTheDocument()
        mockLogin.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }))
        fireEvent.click(
            await within(footer(container)!).findByRole('button', { name: copyRx('setupRedesign.email.logIn') })
        )
        await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1))
        expect(controls()).toContain('log_in:tap')
        // a cancel is no dead end either: the old passkey may not be on this phone
        const support = await within(footer(container)!).findByRole('link', { name: /contact support/i })
        expect(support).toHaveAttribute('href', 'https://peanut.me/support')
        expect(within(footer(container)!).getByText(copyRx('setupRedesign.email.recover'))).toBeInTheDocument()
        fireEvent.click(support)
        expect(controls()).toContain('email_login_support:tap')
        // the save is not retried and the step does not advance: logging in is the way on
        expect(mockUpdateUser).toHaveBeenCalledTimes(1)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('a failed login (no passkey for that account here) keeps recovery and adds support; editing clears it', async () => {
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'x' })
        const { container } = render()
        type('taken@mail.com')
        fireEvent.click(continueButton(container))
        await screen.findByRole('alert')
        mockLogin.mockRejectedValueOnce(new Error('no credentials available'))
        fireEvent.click(
            await within(footer(container)!).findByRole('button', { name: copyRx('setupRedesign.email.logIn') })
        )
        expect(await within(footer(container)!).findByRole('link', { name: /contact support/i })).toBeInTheDocument()
        expect(within(footer(container)!).getByText(copyRx('setupRedesign.email.recover'))).toBeInTheDocument()
        expect(
            within(footer(container)!).getByRole('button', { name: copyRx('setupRedesign.email.logIn') })
        ).toBeEnabled()
        type('other@mail.com')
        expect(screen.queryByRole('link', { name: /contact support/i })).not.toBeInTheDocument()
    })

    it.each([
        ['EMAIL_IN_USE', { status: 409, code: 'EMAIL_IN_USE', error: 'x' }],
        ['the text alone', { error: 'This email is already associated with another account' }],
    ])(
        'an older API (%s) cannot tell holders apart: the taken state, never the deferred one',
        async (_label, response) => {
            mockUpdateUser.mockResolvedValue(response)
            const { container } = render()
            type('someone@mail.com')
            fireEvent.click(continueButton(container))
            expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.taken'))
            expect(setupState(container)).toBe('already-registered')
            expect(screen.queryByText(copyRx('setupRedesign.email.deferred'))).not.toBeInTheDocument()
            expect(controls()).toContain('email:error:already_registered')
            expect(mockNext).not.toHaveBeenCalled()
        }
    )

    it('held by an account that is not established: the deferred note, no error, Continue goes on unsaved', async () => {
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_DORMANT_ACCOUNT', error: 'x' })
        const { container } = render()
        type('dormant@mail.com')
        fireEvent.click(continueButton(container))
        const note = await screen.findByText(copyRx('setupRedesign.email.deferred'))
        expect(note).toHaveAttribute('role', 'status')
        // the field names the note as its description
        expect(describedText()).toMatch(copyRx('setupRedesign.email.deferred'))
        expect(setupState(container)).toBe('deferred')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(field()).not.toHaveAttribute('aria-invalid')
        expect(validCheck()).toBeInTheDocument()
        expect(controls()).toContain('email:error:deferred')
        expect(reportEmailSaveFailure).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
        // Continue now advances without a second save; a double tap advances once
        fireEvent.click(continueButton(container))
        fireEvent.click(primary(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenCalledTimes(1)
    })

    it('P4-13 a generic failure: save-failed line, no aria-invalid, check kept, Continue retries, one report per attempt', async () => {
        mockUpdateUser.mockResolvedValue({ status: 500, error: 'private backend error', failureKind: 'http' })
        const { container } = render()
        type('money@mail.com')
        for (const attempt of [1, 2]) {
            fireEvent.click(continueButton(container))
            await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(attempt))
            await waitFor(() => expect(continueButton(container)).toBeEnabled())
            expect(screen.getByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.saveFailed'))
            expect(setupState(container)).toBe('save-failed')
            expect(field()).not.toHaveAttribute('aria-invalid', 'true')
            expect(describedText()).toContain(copy('setupRedesign.email.saveFailed'))
            expect(validCheck()).toBeInTheDocument()
            expect(field()).toHaveValue('money@mail.com')
            expect(reportEmailSaveFailure).toHaveBeenLastCalledWith(expect.objectContaining({ attempt, status: 500 }))
            expect(controls().filter((c) => c === 'email:error:save_failed')).toHaveLength(attempt)
        }
        expect(mockNext).not.toHaveBeenCalled()
        expect(JSON.stringify(capture.mock.calls)).not.toMatch(/money@mail\.com|private/)
    })

    it('P4-13 a rejected request (network) is a save failure too, never an advance', async () => {
        mockUpdateUser.mockRejectedValueOnce(new Error('network'))
        const { container } = render()
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.saveFailed'))
        expect(mockNext).not.toHaveBeenCalled()
        // retry succeeds and advances
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenCalledTimes(2)
    })

    it('P4-14 without a user id: the not-ready line and event, no request', async () => {
        mockUser = { user: { email: '' } }
        const { container } = render()
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setup.email.notReady'))
        expect(setupState(container)).toBe('not-ready')
        expect(controls()).toContain('email:error:not_ready')
        expect(mockUpdateUser).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it.each([
        [{ status: 401, code: 'STEP_UP_REQUIRED', error: 'STEP_UP_REQUIRED' }, 'step_up_required'],
        [{ status: 400, code: 'EMAIL_VERIFICATION_REQUIRED', error: 'x' }, 'email_verification_required'],
        [{ status: 400, error: 'Email changes require a verification code' }, 'email_verification_required'],
        [{ status: 503, code: 'EMAIL_CHANGE_UNAVAILABLE', error: 'x' }, 'email_replacement_disabled'],
        [{ status: 503, error: 'Email replacement is temporarily disabled' }, 'email_replacement_disabled'],
    ])(
        'P4-15 protected failure %j keeps the current email and advances on Continue with no request',
        async (failure, kind) => {
            mockUser = { user: { userId: 'new-user', email: 'current@mail.com' } }
            mockUpdateUser.mockResolvedValue(failure)
            const { container } = render()
            type('new@mail.com')
            fireEvent.click(continueButton(container))
            const note = await screen.findByText(textMatch(copy('setup.notifications.changeAnytime')))
            expect(note.closest('[role="status"]')).not.toBeNull()
            expect(field()).toHaveValue('current@mail.com')
            expect(setupState(container)).toBe('kept-current')
            expect(controls()).toContain(`email:error:${kind}`)
            // ported from dev Email.test.tsx: a protected failure is still reported, with its kind
            expect(reportEmailSaveFailure).toHaveBeenCalledTimes(1)
            expect(reportEmailSaveFailure).toHaveBeenCalledWith(
                expect.objectContaining({ failureKind: kind, status: failure.status, attempt: 1 })
            )
            expect(continueButton(container)).toBeEnabled()
            expect(mockNext).not.toHaveBeenCalled()
            fireEvent.click(continueButton(container))
            await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
            expect(mockUpdateUser).toHaveBeenCalledTimes(1)
        }
    )

    it('P4-15 with no account email a protected failure is a plain save failure', async () => {
        mockUser = { user: { userId: 'new-user', email: '   ' } }
        mockUpdateUser.mockResolvedValue({ status: 503, error: 'Email replacement is temporarily disabled' })
        const { container } = render()
        type('new@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.saveFailed'))
        expect(screen.queryByText(textMatch(copy('setup.notifications.changeAnytime')))).toBeNull()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('P4-16 an acknowledged save updates the [USER] cache even when fetchUser rejects', async () => {
        queryClient.setQueryData([USER], { user: { userId: 'new-user', email: '' } })
        mockFetchUser.mockRejectedValueOnce(new Error('refresh unavailable'))
        const { container } = render()
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(queryClient.getQueryData([USER])).toEqual({ user: { userId: 'new-user', email: 'money@mail.com' } })
    })

    it('P4-16 a navigation failure after a good save shows no error line and goes to Sentry', async () => {
        const navError = new Error('navigation')
        mockNext.mockRejectedValueOnce(navError)
        const { container } = render()
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(captureException).toHaveBeenCalledWith(navError))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(setupState(container)).not.toBe('save-failed')
        // ported from dev NotificationSetup.test.tsx: the step does not stay stuck in saving
        await waitFor(() => expect(continueButton(container)).toBeEnabled())
    })

    it('P4-16 email:change once per mount however many keystrokes; no control property carries the address', async () => {
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'x' })
        const { container } = render()
        for (const value of ['p', 'pr', 'priv@', 'private@mail.com']) type(value)
        fireEvent.click(continueButton(container))
        await screen.findByRole('alert')
        expect(controls().filter((c) => c === 'email:change')).toHaveLength(1)
        expect(controls()).toEqual(['email:change', 'continue:tap', 'email:error:already_registered'])
        const controlCalls = capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
        for (const [, props] of controlCalls)
            expect(props).toEqual(expect.objectContaining({ screen_id: 'notification-email' }))
        expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|mail\.com/)
    })

    it('P4-64 no query string written by Email holds the address', async () => {
        const { container } = render()
        type('secret.person@mail.com')
        fireEvent.blur(field())
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        for (const update of urlUpdates) expect(update.queryString).not.toMatch(/secret|mail\.com|%40/i)
        expect(window.location.href).not.toMatch(/secret|mail\.com|%40/i)
    })

    it('P4-04 es-AR renders the redesign copy', () => {
        render({ locale: 'es-AR' })
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            copyRx('setupRedesign.email.title', {}, 'es-AR')
        )
        expect(
            screen.getByRole('textbox', { name: copyRx('setupRedesign.email.label', {}, 'es-AR') })
        ).toBeInTheDocument()
    })
})

/** Cases ported from dev's Views/__tests__/Email.test.tsx and NotificationSetup.test.tsx (email part). */
describe('09 Email: ported dev cases', () => {
    it.each([
        { status: 429, error: 'Too many requests' },
        { status: 500, error: 'Internal server error' },
        { status: 503, error: 'Service unavailable' },
    ])('P4-13 a generic HTTP $status keeps the step retryable and never advances', async (failure) => {
        mockUser = { user: { userId: 'new-user', email: 'current@mail.com' } }
        mockUpdateUser.mockResolvedValue(failure)
        const { container } = render()
        type('new@mail.com')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(continueButton(container)).toBeEnabled())
        expect(setupState(container)).toBe('save-failed')
        // a 503 without the replacement wording is not a protected failure: no kept-current note
        expect(screen.queryByText(textMatch(copy('setup.notifications.changeAnytime')))).toBeNull()
        expect(field()).toHaveValue('new@mail.com')
        expect(mockFetchUser).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(2))
        expect(mockNext).not.toHaveBeenCalled()
    })

    it.each([
        ['network', { error: 'Something went wrong. Please try again.', failureKind: 'network' }, undefined],
        ['http', { error: 'Internal error', failureKind: 'http', status: 500 }, 500],
        ['other', undefined, undefined],
    ] as const)(
        'P4-13 a %s failure is reported with its kind, and a second press counts as attempt 2',
        async (kind, result, status) => {
            if (result) mockUpdateUser.mockResolvedValueOnce(result)
            else mockUpdateUser.mockRejectedValueOnce(new Error('boom'))
            mockUpdateUser.mockResolvedValueOnce({ error: 'Internal error', failureKind: 'http', status: 503 })
            const { container } = render()
            type('money@mail.com')
            fireEvent.click(continueButton(container))
            await waitFor(() => expect(reportEmailSaveFailure).toHaveBeenCalledTimes(1))
            expect(reportEmailSaveFailure).toHaveBeenLastCalledWith({ failureKind: kind, status, attempt: 1 })
            await waitFor(() => expect(continueButton(container)).toBeEnabled())
            fireEvent.click(continueButton(container))
            await waitFor(() => expect(reportEmailSaveFailure).toHaveBeenCalledTimes(2))
            expect(reportEmailSaveFailure).toHaveBeenLastCalledWith({ failureKind: 'http', status: 503, attempt: 2 })
            expect(mockNext).not.toHaveBeenCalled()
            expect(JSON.stringify(jest.mocked(reportEmailSaveFailure).mock.calls)).not.toContain('money@mail.com')
        }
    )

    it.each(
        [null, '', '   '].flatMap((email) => [
            { email, status: 400, error: 'Email changes require a verification code' },
            { email, status: 503, error: 'Email replacement is temporarily disabled' },
        ])
    )(
        'P4-15 with account email $email a protected $status is a plain save failure on every attempt',
        async ({ email, status, error }) => {
            mockUser = { user: { userId: 'new-user', email } }
            mockUpdateUser.mockResolvedValue({ status, error })
            const { container } = render()
            type('new@mail.com')
            for (const attempt of [1, 2]) {
                fireEvent.click(continueButton(container))
                await waitFor(() => expect(reportEmailSaveFailure).toHaveBeenCalledTimes(attempt))
                await waitFor(() => expect(continueButton(container)).toBeEnabled())
                expect(screen.getByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.saveFailed'))
                expect(setupState(container)).toBe('save-failed')
                expect(screen.queryByText(textMatch(copy('setup.notifications.changeAnytime')))).toBeNull()
                expect(mockNext).not.toHaveBeenCalled()
            }
            expect(mockUpdateUser).toHaveBeenCalledTimes(2)
        }
    )

    it('P4-11 editing the address clears the duplicate line and brings Continue back', async () => {
        mockUpdateUser.mockResolvedValueOnce({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'x' })
        const { container } = render()
        type('existing@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setupRedesign.email.taken'))
        expect(mockFetchUser).not.toHaveBeenCalled()
        expect(field()).toHaveValue('existing@mail.com')
        type('new@mail.com')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(field()).not.toHaveAttribute('aria-invalid')
        expect(within(footer(container)!).queryByText(copyRx('setupRedesign.email.recover'))).toBeNull()
        expect(setupState(container)).toBe('filled')
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenLastCalledWith({ userId: 'new-user', email: 'new@mail.com' })
    })

    it('P4-14 with no signed-in user at all: the not-ready line, no request, no advance', async () => {
        mockUser = null
        const { container } = render()
        type('money@mail.com')
        fireEvent.click(continueButton(container))
        expect(await screen.findByRole('alert')).toHaveTextContent(copyRx('setup.email.notReady'))
        expect(setupState(container)).toBe('not-ready')
        expect(mockUpdateUser).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('P4-05 Next then Back remounts the step with the trimmed address from the draft', async () => {
        function RoundTrip() {
            const [next, setNext] = useState(false)
            mockNext.mockImplementation(async () => setNext(true))
            return next ? <button onClick={() => setNext(false)}>Back to email</button> : <EmailScreen />
        }
        const wrap = (node: ReactNode) => (
            <NuqsTestingAdapter onUrlUpdate={(event) => urlUpdates.push(event)}>
                <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
            </NuqsTestingAdapter>
        )
        const { container } = renderRedesign(wrap(<RoundTrip />), { screenId: 'notification-email' })
        type('  money@mail.com  ')
        fireEvent.click(continueButton(container))
        fireEvent.click(await screen.findByRole('button', { name: 'Back to email' }))
        expect(field()).toHaveValue('money@mail.com')
    })
})

/** v7 `etypo`: a misspelled common domain gets a one-tap fix. */
describe('09 Email: domain typo help', () => {
    const suggestion = () => screen.queryByTestId('setup-redesign-email-suggestion')

    it('offers the fixed address; one tap fills the field and Continue saves it', async () => {
        const { container } = render()
        type('maria@gmial.com')
        expect(suggestion()).toHaveTextContent('Did you mean maria@gmail.com?')
        fireEvent.click(within(suggestion()!).getByRole('button', { name: 'maria@gmail.com' }))
        expect(field()).toHaveValue('maria@gmail.com')
        expect(suggestion()).not.toBeInTheDocument()
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenCalledWith({ userId: 'new-user', email: 'maria@gmail.com' })
    })

    it('is a hint, not a gate: Continue saves the address as typed', async () => {
        const { container } = render()
        type('maria@company.con')
        expect(suggestion()).toHaveTextContent('maria@company.com')
        expect(continueButton(container)).toBeEnabled()
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockUpdateUser).toHaveBeenCalledWith({ userId: 'new-user', email: 'maria@company.con' })
    })

    it('shows nothing for a right domain, an invalid address or the already-registered state', async () => {
        const { container } = render()
        type('maria@gmail.com')
        expect(suggestion()).not.toBeInTheDocument()
        type('maria@gmial')
        expect(suggestion()).not.toBeInTheDocument()
        mockUpdateUser.mockResolvedValue({ status: 409, code: 'EMAIL_ON_ACTIVE_ACCOUNT', error: 'x' })
        type('maria@gmial.com')
        fireEvent.click(continueButton(container))
        await screen.findByRole('alert')
        expect(suggestion()).not.toBeInTheDocument()
    })

    it('tracks the tap without the address', () => {
        render()
        type('private@hotmial.com')
        fireEvent.click(within(suggestion()!).getByRole('button'))
        expect(controls()).toEqual(['email:change', 'email_suggestion:tap'])
        expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|hotmail/)
    })

    it('renders the es-AR line', () => {
        render({ locale: 'es-AR' })
        fireEvent.change(screen.getByRole('textbox', { name: copyRx('setupRedesign.email.label', {}, 'es-AR') }), {
            target: { value: 'maria@gmial.com' },
        })
        expect(suggestion()).toHaveTextContent('¿Quisiste decir maria@gmail.com?')
    })
})
