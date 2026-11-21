/** @jest-environment jsdom */
// Contract P1 (01 Landing): the recovery link rule, errors and the recovery drawer. Checks P1-14…P1-30.
// Ported from Views/__tests__/Landing.test.tsx (recovery link, TASK-24017 drawer, deleted account).
jest.mock('@/hooks/useLogin', () => require('./landing-state').useLoginModule())
jest.mock('@/hooks/useSetupFlow', () => require('./landing-state').useSetupFlowModule())
jest.mock('@/features/setup/SetupFlowContext', () => require('./landing-state').setupFlowContextModule())
jest.mock('@/features/setup/signup-draft', () => require('./landing-state').signupDraftModule())
jest.mock('@/utils/capacitor', () => require('./landing-state').capacitorModule())
jest.mock('@/utils/native-platform', () => require('./landing-state').nativePlatformModule())
jest.mock('@/hooks/useGetDeviceType', () => require('./landing-state').deviceTypeModule())
jest.mock('@/hooks/useKeepWebBypass', () => require('./landing-state').keepWebModule())
jest.mock('@/constants/migration.consts', () => require('./landing-state').migrationModule())
jest.mock('@/components/Migration/StoreButtons', () => require('./landing-state').storeButtonsModule())
jest.mock('@/components/0_Bruddle/Toast', () => require('./landing-state').toastModule())
jest.mock('@sentry/nextjs', () => require('./landing-state').sentryModule())
jest.mock('@/utils/sentry-lazy', () => require('./landing-state').sentryModule())
jest.mock('posthog-js', () => require('./landing-state').posthogModule())
jest.mock('lottie-web/build/player/lottie_light', () => require('./landing-state').lottieModule())
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () =>
    require('./landing-state').languageSwitcherModule()
)

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { SetupDocsProvider, type SetupDocuments } from '@/components/Setup/components/SetupDocsDrawer'
import { landing, resetLanding, setPlatform } from './landing-state'
import { named, passkeyError, recoveryLinkText, setupCopyFor, signUpButton, tapLogIn } from './landing-helpers'
import { controlsOf, msg, renderInShell, setupState, textOf } from './redesign-harness'
import { markAccountDeleted, readAccountDeletedNotice } from '@/features/setup/account-deleted-notice'

const recoveryLink = () => screen.queryByText(textOf(recoveryLinkText()))
/** The open dialog, if any (vaul keeps a closed drawer in the DOM with data-state="closed"). */
const dialog = () =>
    screen.queryAllByRole('dialog').find((node) => node.getAttribute('data-state') !== 'closed') ?? null
const findOpenDialog = async () => {
    await waitFor(() => expect(dialog()).not.toBeNull())
    return dialog() as HTMLElement
}
const closeDialogAndLogInAgain = async () => {
    fireEvent.keyDown(dialog() as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(dialog()).toBeNull())
    // vaul never finishes its close transition in jsdom, so the page behind stays aria-hidden: tap through it
    await act(async () => {
        fireEvent.click(
            screen.getByRole('button', { name: named(msg('setupRedesign.landing.loginBtn')), hidden: true })
        )
    })
}
const webLogIn = () => msg('migration.qr.logIn')

beforeEach(() => {
    jest.useFakeTimers()
    resetLanding()
    jest.mocked(posthog.capture).mockClear()
})
afterEach(() => jest.useRealTimers())

describe('01 Landing — the recovery link rule (ruling 1, K7, K8)', () => {
    it('P1-14 LOGIN_ERROR on the first attempt: the link shows, state login-failed, one toast, no drawer', async () => {
        landing.login.mockRejectedValue(passkeyError('LOGIN_ERROR'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()

        await waitFor(() => expect(recoveryLink()).toBeInTheDocument())
        expect(setupState()).toBe('login-failed')
        expect(landing.toastError).toHaveBeenCalledTimes(1)
        expect(dialog()).not.toBeInTheDocument()
    })

    it.each([
        ['LOGIN_ERROR', () => passkeyError('LOGIN_ERROR')],
        ['ACCOUNT_DELETED', () => passkeyError('ACCOUNT_DELETED')],
        ['PASSKEY_NOT_FOUND', () => passkeyError('PASSKEY_NOT_FOUND')],
        ['a network error', () => new TypeError('Failed to fetch')],
        ['a timeout', () => Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' })],
        ['an Error with no code', () => new Error('boom')],
    ])('P1-15 the first attempt failing with %s shows the recovery link', async (_, error) => {
        landing.login.mockRejectedValue(error())
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()

        await waitFor(() => expect(recoveryLink()).toBeInTheDocument())
        expect(setupState()).toBe('login-failed')
    })

    it('P1-16 iPhone: one cancel toasts the cancel copy only; the second shows the link and the drawer, still one toast', async () => {
        landing.login.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        expect(landing.toastError).toHaveBeenCalledWith(setupCopyFor('LOGIN_CANCELED'))
        expect(recoveryLink()).not.toBeInTheDocument()
        expect(dialog()).not.toBeInTheDocument()
        expect(setupState()).toBe('default')

        await tapLogIn()
        expect(await findOpenDialog()).toBeInTheDocument()
        expect(recoveryLink()).toBeInTheDocument()
        expect(landing.toastError).toHaveBeenCalledTimes(1)
    })

    it('P1-17 web download-only: the second cancel shows the link under "Log in on web instead" and opens the drawer', async () => {
        setPlatform('web')
        landing.login.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn(webLogIn())
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        expect(recoveryLink()).not.toBeInTheDocument()
        expect(dialog()).not.toBeInTheDocument()

        await tapLogIn(webLogIn())
        expect(await findOpenDialog()).toBeInTheDocument()
        const link = recoveryLink()
        expect(link).toBeInTheDocument()
        const webButton = screen.getByRole('button', { name: named(webLogIn()), hidden: true })
        expect(webButton.compareDocumentPosition(link as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(landing.toastError).toHaveBeenCalledTimes(1)
    })

    it('P1-18 Android app: three cancels give three toasts, never the link, never the drawer', async () => {
        setPlatform('android')
        landing.login.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        for (const count of [1, 2, 3]) {
            await tapLogIn()
            await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(count))
            expect(recoveryLink()).not.toBeInTheDocument()
            expect(dialog()).not.toBeInTheDocument()
        }
    })

    it('P1-19 iPhone: cancel, LOGIN_ERROR, cancel — no drawer (the error reset the count), and the link stays on', async () => {
        landing.login
            .mockRejectedValueOnce(passkeyError('LOGIN_CANCELED'))
            .mockRejectedValueOnce(passkeyError('LOGIN_ERROR'))
            .mockRejectedValueOnce(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(2))
        expect(recoveryLink()).toBeInTheDocument()
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(3))
        expect(dialog()).not.toBeInTheDocument()
        expect(recoveryLink()).toBeInTheDocument()
    })

    it('P1-20 iPhone: cancel, PASSKEY_NOT_FOUND, cancel — the drawer opens on the 2nd and again on the 3rd', async () => {
        landing.login
            .mockRejectedValueOnce(passkeyError('LOGIN_CANCELED'))
            .mockRejectedValueOnce(passkeyError('PASSKEY_NOT_FOUND'))
            .mockRejectedValueOnce(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        expect(dialog()).not.toBeInTheDocument()
        await tapLogIn()
        expect(await findOpenDialog()).toBeInTheDocument()
        await closeDialogAndLogInAgain()
        expect(await findOpenDialog()).toBeInTheDocument()
        expect(landing.toastError).toHaveBeenCalledTimes(1)
    })

    it('P1-21 iPhone: three cancels — the drawer opens on the 2nd and on the 3rd', async () => {
        landing.login.mockRejectedValue(passkeyError('LOGIN_CANCELED'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        await tapLogIn()
        expect(await findOpenDialog()).toBeInTheDocument()
        await closeDialogAndLogInAgain()
        expect(await findOpenDialog()).toBeInTheDocument()
        expect(landing.toastError).toHaveBeenCalledTimes(1)
    })

    it('P1-22 once on, the link survives a later login start, a cancel and a rerender; a fresh mount starts without it', async () => {
        landing.login
            .mockRejectedValueOnce(passkeyError('LOGIN_ERROR'))
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(passkeyError('LOGIN_CANCELED'))
        const view = renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(recoveryLink()).toBeInTheDocument())
        await tapLogIn()
        expect(recoveryLink()).toBeInTheDocument()
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(2))
        expect(recoveryLink()).toBeInTheDocument()
        view.rerenderInShell(<LandingScreen />)
        expect(recoveryLink()).toBeInTheDocument()
        expect(setupState()).toBe('login-failed')

        view.unmount()
        renderInShell('landing', <LandingScreen />)
        expect(recoveryLink()).not.toBeInTheDocument()
        expect(setupState()).toBe('default')
    })

    it('P1-23 the recovery link opens the account-recovery doc (SetupDocLink kind account-recovery, href /en/help/account-recovery)', async () => {
        const doc = (title: string) => ({ title, content: <p>{title} body</p> })
        const localized = (title: string) => ({
            en: doc(title),
            'es-419': doc(title),
            'es-ar': doc(title),
            'pt-br': doc(title),
        })
        const documents: SetupDocuments = {
            terms: doc('Terms'),
            privacy: doc('Privacy'),
            'account-recovery': localized('Account recovery guide'),
            passkeys: localized('Passkeys guide'),
        }
        // Without the docs provider the link is a plain link to the help page.
        landing.login.mockRejectedValue(passkeyError('LOGIN_ERROR'))
        const plain = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await waitFor(() => expect(recoveryLink()).toBeInTheDocument())
        expect(recoveryLink()?.closest('a')).toHaveAttribute('href', '/en/help/account-recovery')
        plain.unmount()

        // With it (as in /setup), a tap opens the doc in the drawer and reports account-recovery_doc:open.
        renderInShell('landing', <LandingScreen />, {
            wrap: (node) => <SetupDocsProvider documents={documents}>{node}</SetupDocsProvider>,
        })
        await tapLogIn()
        await waitFor(() => expect(recoveryLink()).toBeInTheDocument())
        await act(async () => {
            fireEvent.click(recoveryLink() as HTMLElement)
        })
        expect(await findOpenDialog()).toHaveTextContent('Account recovery guide')
        expect(controlsOf(jest.mocked(posthog.capture))).toContain('account-recovery_doc:open')
    })
})

describe('01 Landing — errors (K9, K10, S5)', () => {
    it('P1-24 PASSKEY_NOT_FOUND on the first attempt: the recovery dialog, no toast', async () => {
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()

        expect(await findOpenDialog()).toHaveTextContent(msg('setup.loginRecovery.title'))
        expect(landing.toastError).not.toHaveBeenCalled()
    })

    it('P1-25 ACCOUNT_DELETED: the callout, no toast, no dialog; Sign up still advances; the next Log in clears it', async () => {
        landing.login.mockRejectedValueOnce(passkeyError('ACCOUNT_DELETED')).mockResolvedValueOnce(undefined)
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()

        expect(await screen.findByTestId('account-deleted')).toHaveTextContent(msg('setup.passkey.accountDeleted'))
        expect(landing.toastError).not.toHaveBeenCalled()
        expect(dialog()).not.toBeInTheDocument()
        fireEvent.click(signUpButton())
        expect(landing.next).toHaveBeenCalledTimes(1)

        await tapLogIn()
        await waitFor(() => expect(screen.queryByTestId('account-deleted')).not.toBeInTheDocument())
    })

    it('P1-25b a deletion from Settings: the callout shows without a log-in; the next Log in clears it (api#2227)', async () => {
        markAccountDeleted()
        landing.login.mockResolvedValueOnce(undefined)
        renderInShell('landing', <LandingScreen />)

        expect(await screen.findByTestId('account-deleted')).toHaveTextContent(msg('setup.passkey.accountDeleted'))
        await tapLogIn()
        await waitFor(() => expect(screen.queryByTestId('account-deleted')).not.toBeInTheDocument())
        expect(readAccountDeletedNotice()).toBe(false)
    })

    it('P1-26 web download-only, ACCOUNT_DELETED: the callout comes before the store buttons', async () => {
        setPlatform('web')
        landing.login.mockRejectedValue(passkeyError('ACCOUNT_DELETED'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn(webLogIn())

        const callout = await screen.findByTestId('account-deleted')
        expect(callout.compareDocumentPosition(screen.getByTestId('store-buttons'))).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        )
    })

    it('P1-27 an error with no setup key toasts its own message; one with neither toasts setup.loginFailed', async () => {
        landing.login
            .mockRejectedValueOnce(new Error('The relying party refused the request.'))
            .mockRejectedValueOnce(new Error(''))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(1))
        expect(landing.toastError).toHaveBeenLastCalledWith('The relying party refused the request.')
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(2))
        expect(landing.toastError).toHaveBeenLastCalledWith(msg('setup.loginFailed'))
    })

    it('P1-28 Sentry gets { extra: { errorCode } } for an unreported LOGIN_ERROR, and nothing for an already reported one', async () => {
        const unreported = Object.assign(new Error('raw'), { code: 'LOGIN_ERROR' })
        landing.login.mockRejectedValueOnce(unreported).mockRejectedValueOnce(passkeyError('LOGIN_ERROR'))
        renderInShell('landing', <LandingScreen />)

        await tapLogIn()
        await waitFor(() => expect(landing.sentry).toHaveBeenCalledTimes(1))
        expect(landing.sentry).toHaveBeenCalledWith(unreported, { extra: { errorCode: 'LOGIN_ERROR' } })
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalledTimes(2))
        expect(landing.sentry).toHaveBeenCalledTimes(1)
    })
})

describe('01 Landing — recovery drawer actions (K11)', () => {
    it('P1-29 Retry logs in again and the dialog returns on the same failure; "I’m new" then starts sign-up once', async () => {
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await findOpenDialog()

        fireEvent.click(screen.getByRole('button', { name: named(msg('common.retry')) }))
        await waitFor(() => expect(landing.login).toHaveBeenCalledTimes(2))
        expect(await findOpenDialog()).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: msg('setup.loginRecovery.signUp') }))
        expect(landing.next).toHaveBeenCalledTimes(1)
    })

    it('P1-30 web download-only, PASSKEY_NOT_FOUND: the dialog says "Log in on that phone." and offers no sign-up', async () => {
        setPlatform('web')
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        renderInShell('landing', <LandingScreen />)
        await tapLogIn(webLogIn())

        expect(await findOpenDialog()).toHaveTextContent(msg('setup.loginRecovery.steps.web.thatPhone'))
        expect(screen.queryByRole('button', { name: msg('setup.loginRecovery.signUp') })).not.toBeInTheDocument()
    })
})
