/** @jest-environment jsdom */
/**
 * 11 Final confirm (`advantage-control` before completion, and `/setup/finish`), contract P4 § 4.
 * Written from the contract before the screen exists. useAccountSetup is NOT mocked: navigation is observed on
 * the router, and the account-completion request on `addAccount`, as dev's SignTestTransaction suite does.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { SetupDocsProvider, type SetupDocuments } from '@/components/Setup/components/SetupDocsDrawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SignupTestTxError } from '@/features/setup/signup-test-tx-error'
import {
    readSignupTestTransaction,
    saveSignupTestTransaction,
    type SignupTestTransaction,
} from '@/features/setup/signup-test-transaction'
import { AccountType } from '@/interfaces/interfaces'
import { AccountSetupError } from '@/services/account-setup'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import { confettiPresets } from '@/utils/confetti'
import { UserOpSubmissionError } from '@/utils/userop-submission'
import { signupControls } from '@/test-utils/signup-controls'
import { FinalConfirmScreen } from '../FinalConfirmScreen'
import { FinalStep } from '../FinalStep'
import {
    copy,
    copyRx,
    rawCopy,
    renderRedesign,
    setupState,
    textMatch,
    visibleText,
} from '../../Accounts/__tests__/redesignHarness'

jest.mock('@/services/signup-geo', () => ({ attachSignupGeo: jest.fn() }))

const WALLET = '0x1111111111111111111111111111111111111111'
const HASH = `0x${'ab'.repeat(32)}` as const

const mockRouterReplace = jest.fn()
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
    useSearchParams: () => ({ get: () => null }),
}))
const mockSend = jest.fn()
jest.mock('@/features/setup/useSignupTestTransaction', () => ({
    useSignupTestTransaction: () => ({ sendTestTransaction: mockSend }),
}))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: WALLET }) }))

let accounts: Array<{ type: AccountType }> = []
let mockUserLoaded = true
let mockIsFetchingUser = false
let mockIsLoggingOut = false
const mockAddAccount = jest.fn()
const mockFetchUser = jest.fn()
const mockLogoutUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: mockUserLoaded ? { user: { userId: 'user-1', username: 'kim' }, accounts } : null,
        isFetchingUser: mockIsFetchingUser,
        fetchUser: mockFetchUser,
        addAccount: mockAddAccount,
        logoutUser: mockLogoutUser,
        isLoggingOut: mockIsLoggingOut,
    }),
}))
const mockHandleNext = jest.fn(async () => {})
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn(async () => ({ data: {} })) }))
jest.mock('@/utils/passkeyDebug', () => ({ capturePasskeyDebugInfo: jest.fn() }))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { celebration: jest.fn(), success: jest.fn() } }))
jest.mock('@/utils/haptics', () => ({ notifyHaptic: jest.fn() }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@/utils/signup-attribution', () => ({
    readSignupAttributionAsync: jest.fn(async () => null),
    clearSignupAttribution: jest.fn(async () => undefined),
    hasPendingSignupAttribution: jest.fn(async () => false),
}))
const mockLatestCeremony = jest.fn()
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    ...jest.requireActual('@/utils/webauthn-ceremony-telemetry'),
    latestCeremony: (...args: unknown[]) => mockLatestCeremony(...args),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 20,
            frameRate: 30,
            addEventListener: jest.fn(),
            destroy: jest.fn(),
            goToAndStop: jest.fn(),
            playSegments: jest.fn(),
        }),
    },
}))
let mockReduced = false
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell(() => mockReduced))

const capture = posthog.capture as jest.Mock
const events = (name: string) => capture.mock.calls.filter(([event]) => event === name).map(([, props]) => props)

const DOCS: SetupDocuments = {
    terms: { title: 'Terms doc', content: <p>terms</p> },
    privacy: { title: 'Privacy doc', content: <p>privacy</p> },
    'account-recovery': {
        en: { title: 'Recovery doc', content: <p>r</p> },
        'es-419': { title: 'Recovery doc', content: <p>r</p> },
        'es-ar': { title: 'Recovery doc', content: <p>r</p> },
        'pt-br': { title: 'Recovery doc', content: <p>r</p> },
    },
    passkeys: {
        en: { title: 'Passkeys guide doc', content: <p>guide</p> },
        'es-419': { title: 'Passkeys guide doc', content: <p>guide</p> },
        'es-ar': { title: 'Passkeys guide doc', content: <p>guide</p> },
        'pt-br': { title: 'Passkeys guide doc', content: <p>guide</p> },
    },
}

type RenderOpts = {
    onComplete?: () => void
    showLogout?: boolean
    locale?: 'en' | 'es-AR'
    seed?: Parameters<typeof renderRedesign>[1]['seed']
}
const render = ({ onComplete, showLogout, locale = 'en', seed }: RenderOpts = {}) =>
    renderRedesign(
        <SetupDocsProvider documents={DOCS}>
            <FinalConfirmScreen onComplete={onComplete} showLogout={showLogout} />
        </SetupDocsProvider>,
        {
            screenId: showLogout ? 'sign-test-transaction' : 'advantage-control',
            locale,
            seed,
            showBackButton: true,
        }
    )

/** The shell's fixed footer: the last one in the document (a placeholder panel may hold an old footer). */
const shellFooter = (container: HTMLElement) => {
    const all = container.querySelectorAll<HTMLElement>('[data-setup-footer]')
    if (!all.length) throw new Error('no footer drawn')
    return all[all.length - 1]
}
/** The pink primary: the contract's test hook on the shell footer's first button. */
const primary = (container: HTMLElement) => within(shellFooter(container)).getByTestId('setup-redesign-primary')
/** A control in the footer (slot link, below link) found by its catalog text. */
const footerControl = (container: HTMLElement, text: RegExp) => {
    const el = within(shellFooter(container)).getByText(text).closest('button, a')
    if (!el) throw new Error(`no control for ${text}`)
    return el as HTMLElement
}
/** A button's own label, without the spinner's screen-reader text. */
const label = (el: HTMLElement) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[role="status"]').forEach((node) => node.remove())
    return visibleText(clone)
}
const queryFooterText = (container: HTMLElement, text: RegExp) => within(shellFooter(container)).queryByText(text)

const confirm = (container: HTMLElement) => fireEvent.click(primary(container))

const pending = (overrides: Partial<SignupTestTransaction> = {}): SignupTestTransaction => ({
    chainId: 42161,
    sender: WALLET,
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    userOpHash: HASH,
    userOperation: { sender: WALLET, nonce: '0x0', callData: '0x', signature: '0x01' } as never,
    signatureCheck: 'valid',
    signatureRejected: false,
    needsNewSignature: false,
    transientFailures: 2,
    mined: false,
    deferred: false,
    deferredRetries: 0,
    signedAt: Date.now(),
    ...overrides,
})
const stalled = () =>
    new SignupTestTxError(
        'submit',
        new UserOpSubmissionError('transient', HASH, 3, true, new Error('timeout')),
        'valid'
    )
const aa24 = () =>
    new SignupTestTxError(
        'submit',
        Object.assign(new Error('Signature provided for the User Operation is invalid.'), {
            name: 'UserOperationExecutionError',
            details: 'UserOperation reverted with reason: AA24 signature error',
        }),
        'valid'
    )

const setReducedMotion = (matches: boolean) => {
    mockReduced = matches
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: matches && query.includes('reduce'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    setReducedMotion(false)
    accounts = []
    mockUserLoaded = true
    mockIsFetchingUser = false
    mockIsLoggingOut = false
    mockSend.mockResolvedValue({ userOpHash: HASH, reusedSignature: false, sends: 1, recovered: [] })
    mockFetchUser.mockResolvedValue(undefined)
    mockAddAccount.mockImplementation(async () => {
        accounts = [{ type: AccountType.PEANUT_WALLET }]
    })
    jest.mocked(capturePasskeyDebugInfo).mockResolvedValue(undefined as never)
    mockLatestCeremony.mockReturnValue({ challengeOffset: 41, backupEligible: false })
})

describe('11 Final confirm: states', () => {
    it('P4-34 before the user loads the primary reads Loading... and is disabled', () => {
        mockUserLoaded = false
        mockIsFetchingUser = true
        const { container } = render({ onComplete: jest.fn() })
        expect(primary(container)).toBeDisabled()
        expect(label(primary(container))).toBe(copy('common.loading'))
        expect(within(primary(container)).getByRole('status')).toBeInTheDocument()
        expect(setupState(container)).toBe('loading-user')
    })

    it('P4-34 a failed user fetch shows the reload line and reports its key', async () => {
        mockUserLoaded = false
        mockFetchUser.mockRejectedValue(new Error('offline'))
        const { container } = render({ onComplete: jest.fn() })
        expect(await screen.findByText(copyRx('setup.testTransaction.errors.loadUserFailed'))).toBeInTheDocument()
        expect(signupControls(capture)).toContain('finish:error:testTransaction.errors.loadUserFailed')
        expect(setupState(container)).toBe('error-refresh')
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ tags: expect.objectContaining({ feature: 'signup-test-transaction' }) })
        )
    })

    it('P4-35 default: title, Confirm & finish, and the passkey link in the slot', () => {
        const { container } = render({ onComplete: jest.fn() })
        expect(container.querySelector('[data-testid="setup-redesign-final-confirm"]')).not.toBeNull()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.final.title'))
        expect(screen.getByText(textMatch(copy('setupRedesign.final.desc')))).toBeInTheDocument()
        expect(label(primary(container))).toBe(copy('setupRedesign.final.cta'))
        expect(primary(container)).toBeEnabled()
        expect(footerControl(container, copyRx('setupRedesign.final.what'))).toBeInTheDocument()
        expect(setupState(container)).toBe('default')
    })

    it('P4-36 the primary reports finish:tap and started, shows loading, and ignores a second tap', async () => {
        mockSend.mockReturnValue(new Promise(() => undefined))
        const { container } = render({ onComplete: jest.fn() })
        confirm(container)
        expect(signupControls(capture)).toEqual(['finish:tap'])
        expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_STARTED)).toHaveLength(1)
        await waitFor(() => expect(setupState(container)).toBe('prompt'))
        expect(primary(container)).toBeDisabled()
        expect(within(primary(container)).getByRole('status')).toBeInTheDocument()
        fireEvent.click(primary(container))
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_STARTED)).toHaveLength(1)
    })

    it('P4-37 a confirmed signature and saved account hand over to the celebration once, with no redirect', async () => {
        const onComplete = jest.fn()
        const { container } = render({ onComplete })
        confirm(container)
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_SIGNED)).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_COMPLETED)).toEqual([expect.objectContaining({ test_tx: 'confirmed' })])
        expect(mockAddAccount).toHaveBeenCalledWith(expect.objectContaining({ accountIdentifier: WALLET }))
        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(confettiPresets.celebration).not.toHaveBeenCalled()
        expect(setupState(container)).toBe('success')
        expect(primary(container)).toBeDisabled()
    })

    it('P4-37 on the sign-up step, completion swaps 11 for the 12 celebration (FinalStep)', async () => {
        let setCompleted: ((v: boolean) => void) | null = null
        const view = renderRedesign(<FinalStep onComplete={() => setCompleted?.(true)} />, {
            screenId: 'advantage-control',
        })
        setCompleted = view.flow().setSignupCompleted
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.final.title'))
        confirm(view.container)
        await waitFor(() =>
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.done.title'))
        )
        expect(view.container.querySelector('[data-testid="setup-redesign-celebration"]')).not.toBeNull()
        expect(view.container.querySelector('[data-testid="setup-redesign-final-confirm"]')).toBeNull()
    })

    it('P4-38 a failed account save offers Retry account setup, which saves again without a second signature', async () => {
        mockAddAccount.mockRejectedValueOnce(
            new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts: 2,
                status: 503,
            })
        )
        const onComplete = jest.fn()
        const { container } = render({ onComplete })
        confirm(container)
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(copyRx('setupRedesign.final.setupFailed'))
        expect(setupState(container)).toBe('setup-failed')
        await waitFor(() => expect(primary(container)).toBeEnabled())
        expect(label(primary(container))).toBe(copy('setupRedesign.final.retrySetup'))
        expect(signupControls(capture)).toContain('finish:error:testTransaction.errors.setupFailed')
        expect(onComplete).not.toHaveBeenCalled()

        confirm(container)
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(mockAddAccount).toHaveBeenCalledTimes(2)
        expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('P4-39 a first busy network shows the warning and Try again, but no Confirm later', async () => {
        mockSend.mockRejectedValueOnce(stalled())
        const { container } = render({ onComplete: jest.fn() })
        confirm(container)
        expect(await screen.findByText(textMatch(copy('setupRedesign.final.busy')))).toBeInTheDocument()
        await waitFor(() => expect(primary(container)).toBeEnabled())
        expect(label(primary(container))).toBe(copy('setupRedesign.common.retry'))
        expect(setupState(container)).toBe('network-busy-first')
        expect(footerControl(container, copyRx('setupRedesign.final.what'))).toBeInTheDocument()
        expect(queryFooterText(container, copyRx('setupRedesign.final.later'))).toBeNull()
        // dev's deferral helper line is dropped (P4 § 8.4)
        expect(screen.queryByText(copyRx('setup.testTransaction.finishLaterDescription'))).toBeNull()
        // the shown copy is the redesign's, the tracked key stays dev's
        expect(screen.queryByText(copyRx('setup.testTransaction.errors.networkBusy'))).toBeNull()
        expect(signupControls(capture)).toContain('finish:error:testTransaction.errors.networkBusy')
    })

    it('P4-39 after two transient failures Confirm later finishes the sign-up and keeps the operation', async () => {
        saveSignupTestTransaction('user-1', pending())
        mockSend.mockRejectedValueOnce(stalled())
        const onComplete = jest.fn()
        const { container } = render({ onComplete })
        confirm(container)
        await screen.findByText(textMatch(copy('setupRedesign.final.busy')))
        expect(setupState(container)).toBe('network-busy')
        const later = footerControl(container, copyRx('setupRedesign.final.later'))
        await waitFor(() => expect(later).toBeEnabled())
        fireEvent.click(later)
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(signupControls(capture)).toContain('finish_later:tap')
        expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED)).toEqual([
            { transient_failures: 2, signature_check: 'valid' },
        ])
        expect(events(ANALYTICS_EVENTS.SIGNUP_COMPLETED)).toEqual([expect.objectContaining({ test_tx: 'deferred' })])
        expect(mockAddAccount).toHaveBeenCalledTimes(1)
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(readSignupTestTransaction('user-1')).toMatchObject({ deferred: true, mined: false })
    })
})

describe('11 Final confirm: art', () => {
    /** An ArtPiece box in design px from its inline style. */
    const box = (el: Element | null) => {
        let node = el as HTMLElement | null
        while (node && !(node.style.left && node.style.top)) node = node.parentElement
        if (!node) throw new Error('no placed art piece')
        const px = (v: string) => parseFloat(v)
        const left = px(node.style.left)
        const top = px(node.style.top)
        return { left, top, right: left + px(node.style.width), bottom: top + px(node.style.height) }
    }
    const intersects = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

    it('P4-40 the coins sit beside the scan frame, never inside it, and the frame holds the smile', () => {
        const { container } = render({ onComplete: jest.fn() })
        const frameEl = container.querySelector('[data-testid="setup-redesign-final-confirm-frame"]')
        expect(frameEl).not.toBeNull()
        const frame = box(frameEl)
        expect(frame).toEqual({ left: 120, top: 196, right: 270, bottom: 372 })
        const usd = box(container.querySelector('[data-coin-still="usd"]'))
        const eur = box(container.querySelector('[data-coin-still="eur"]'))
        expect(intersects(usd, frame)).toBe(false)
        expect(intersects(eur, frame)).toBe(false)
        expect(usd.right).toBeLessThanOrEqual(frame.left)
        expect(eur.left).toBeGreaterThanOrEqual(frame.right)
        expect(frameEl!.querySelector('svg.lucide-smile')).not.toBeNull()
    })

    it('P4-63 under reduced motion no entrance plays and the coins keep their still frame', () => {
        setReducedMotion(true)
        const { container } = render({ onComplete: jest.fn() })
        for (const coin of ['usd', 'eur']) {
            const still = container.querySelector(`[data-coin-still="${coin}"]`)
            expect(still).not.toBeNull()
            expect(still).not.toHaveClass('opacity-0')
        }
        for (const piece of container.querySelectorAll<HTMLElement>('[data-setup-art-box] > div')) {
            expect(piece.style.opacity === '' || piece.style.opacity === '1').toBe(true)
        }
    })
})

describe('11 Final confirm: failures', () => {
    const failWith = async (error: unknown) => {
        mockSend.mockRejectedValueOnce(error)
        const view = render({ onComplete: jest.fn() })
        confirm(view.container)
        await waitFor(() => expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_FAILED)).toHaveLength(1))
        return { ...view, event: events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_FAILED)[0] }
    }

    it('P4-41 AA24 names the password manager, never offers Confirm later, and reports is_aa24', async () => {
        saveSignupTestTransaction('user-1', pending({ signatureRejected: true }))
        const { container, event } = await failWith(aa24())
        expect(
            await screen.findByText(copyRx('setup.testTransaction.errors.passkeyProviderUnsupported'))
        ).toBeInTheDocument()
        expect(queryFooterText(container, copyRx('setupRedesign.final.later'))).toBeNull()
        expect(event).toMatchObject({ is_aa24: true, failure_mode: 'signature_invalid', deferral_offered: false })
        expect(setupState(container)).toBe('error-provider')
        expect(mockAddAccount).not.toHaveBeenCalled()
    })

    it.each([
        [
            'needs_new_signature',
            () =>
                new SignupTestTxError(
                    'submit',
                    new UserOpSubmissionError('expired', HASH, 1, false, new Error('expired'))
                ),
            'setup.testTransaction.errors.confirmAgain',
            'error-confirm-again',
        ],
        [
            'unknown',
            () => new SignupTestTxError('submit', new Error('AA21 didn’t pay prefund')),
            'setup.testTransaction.errors.supportNeeded',
            'error-support',
        ],
        [
            'a passkey cancel',
            () =>
                Object.assign(new Error('The operation either timed out or was not allowed.'), {
                    name: 'NotAllowedError',
                }),
            'setup.passkey.notCompleted',
            'error-passkey',
        ],
        [
            'a passkey failure with no code',
            () => new SignupTestTxError('sign', new Error('')),
            'setup.passkey.interrupted',
            'error-passkey',
        ],
    ])('P4-42 %s shows its dev copy and the primary retries the same handler', async (_, error, key, state) => {
        const { container } = await failWith(error())
        expect(await screen.findByText(copyRx(key))).toBeInTheDocument()
        expect(setupState(container)).toBe(state)
        await waitFor(() => expect(primary(container)).toBeEnabled())
        expect(label(primary(container))).toBe(copy('setupRedesign.final.cta'))
        mockSend.mockReturnValueOnce(new Promise(() => undefined))
        confirm(container)
        expect(mockSend).toHaveBeenCalledTimes(2)
        expect(events(ANALYTICS_EVENTS.SIGNUP_TEST_TX_STARTED)).toHaveLength(2)
    })

    it('P4-43 the failure event carries every listed property and no raw message; error values are catalog keys', async () => {
        const { event } = await failWith(new Error('private provider diagnostic'))
        for (const property of [
            'error_name',
            'error_code',
            'is_aa24',
            'failure_mode',
            'phase',
            'submission_kind',
            'transient_failures',
            'signature_check',
            'deferral_offered',
            'backup_eligible',
            'challenge_offset',
        ]) {
            expect(Object.keys(event)).toContain(property)
        }
        expect(JSON.stringify(capture.mock.calls)).not.toContain('private provider diagnostic')
        const errorValues = signupControls(capture)
            .filter((c) => c.startsWith('finish:error:'))
            .map((c) => c.slice('finish:error:'.length))
        expect(errorValues.length).toBeGreaterThan(0)
        for (const value of errorValues) {
            if (value === 'setup_failed') continue
            expect(() => rawCopy(`setup.${value}`)).not.toThrow()
        }
    })

    it('P4-44 an error shown before a language switch follows the new language', async () => {
        mockSend.mockRejectedValueOnce(new Error('Signing failed'))
        const view = render({ onComplete: jest.fn() })
        confirm(view.container)
        expect(await screen.findByText(copyRx('setup.testTransaction.errors.supportNeeded'))).toBeInTheDocument()
        await view.setLocale('es-AR')
        expect(screen.getByText(copyRx('setup.testTransaction.errors.supportNeeded', {}, 'es-AR'))).toBeInTheDocument()
        expect(screen.queryByText(copyRx('setup.testTransaction.errors.supportNeeded'))).toBeNull()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            copyRx('setupRedesign.final.title', {}, 'es-AR')
        )
    })
})

describe('11 Final confirm: passkey explainer', () => {
    it('P4-45 opens with three paragraphs, Got it and the full guide; reports open, Got it and dismiss', async () => {
        const { container } = render({ onComplete: jest.fn() })
        const what = () => footerControl(container, copyRx('setupRedesign.final.what'))

        fireEvent.click(what())
        const dialog = await screen.findByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') })
        for (const key of ['infoWhat', 'infoBackup', 'infoPrivacy']) {
            expect(within(dialog).getByText(textMatch(copy(`setupRedesign.final.${key}`)))).toBeInTheDocument()
        }
        expect(visibleText(dialog).toLowerCase()).not.toMatch(/no password|example/)
        fireEvent.click(within(dialog).getByRole('button', { name: copyRx('setupRedesign.final.gotIt') }))
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') })).toBeNull()
        )

        fireEvent.click(what())
        fireEvent.keyDown(await screen.findByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') }), {
            key: 'Escape',
        })
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') })).toBeNull()
        )

        fireEvent.click(what())
        const again = await screen.findByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') })
        fireEvent.click(within(again).getByText(copyRx('setupRedesign.final.fullGuide')).closest('button, a')!)
        expect(await screen.findByRole('dialog', { name: 'Passkeys guide doc' })).toBeInTheDocument()
        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: copyRx('setupRedesign.final.infoTitle') })).toBeNull()
        )

        expect(signupControls(capture)).toEqual([
            'passkey_info:open',
            'passkey_info_got_it:tap',
            'passkey_info:open',
            'passkey_info:dismiss',
            'passkey_info:open',
            'passkeys_doc:open',
        ])
    })
})

describe('11 Final confirm on /setup/finish', () => {
    it('P4-47 shows Log out under the footer only with showLogout, and it logs out', () => {
        const without = render({ onComplete: jest.fn() })
        expect(screen.queryByText(copyRx('profile.logOut'))).toBeNull()
        without.unmount()

        const { container } = render({ showLogout: true })
        const logOut = footerControl(container, copyRx('profile.logOut'))
        expect(logOut.closest('[data-testid="setup-redesign-below"]')).not.toBeNull()
        fireEvent.click(logOut)
        expect(mockLogoutUser).toHaveBeenCalledTimes(1)
        expect(signupControls(capture)).toEqual(['log_out:tap'])
        expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ screen_id: 'sign-test-transaction' }))
    })

    it('P4-47 Log out is disabled while logging out', () => {
        mockIsLoggingOut = true
        const { container } = render({ showLogout: true })
        const logOut = footerControl(container, copyRx('profile.logOut'))
        expect(logOut.hasAttribute('disabled') || logOut.getAttribute('aria-disabled') === 'true').toBe(true)
    })

    it('P4-48 an account that already has a wallet is sent on once, without signing', () => {
        accounts = [{ type: AccountType.PEANUT_WALLET }]
        const view = render({ showLogout: true })
        view.rerenderSame()
        expect(mockRouterReplace).toHaveBeenCalledTimes(1)
        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(mockSend).not.toHaveBeenCalled()
        expect(mockAddAccount).not.toHaveBeenCalled()
    })

    it('P4-48 a confirmation on the finish route celebrates once and redirects as a new account', async () => {
        const { container } = render({ showLogout: true })
        confirm(container)
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1))
        expect(mockRouterReplace).toHaveBeenCalledWith('/home')
        expect(confettiPresets.celebration).toHaveBeenCalledTimes(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_COMPLETED)).toHaveLength(1)
    })
})

describe('11 Final confirm: the plan reaches the account', () => {
    it('P4-49 sends both chosen channels, and a retry after a changed plan sends the new ones', async () => {
        mockAddAccount.mockRejectedValueOnce(
            new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts: 2,
                status: 503,
            })
        )
        const onComplete = jest.fn()
        const view = render({ onComplete, seed: { fundingChannel: 'brlBank', paymentChannel: 'qr' } })
        confirm(view.container)
        await waitFor(() =>
            expect(mockAddAccount).toHaveBeenCalledWith(
                expect.objectContaining({ signupPreferences: { fundingChannel: 'brlBank', paymentChannel: 'qr' } })
            )
        )
        await waitFor(() => expect(primary(view.container)).toBeEnabled())
        act(() => view.flow().setPaymentChannel('card'))
        confirm(view.container)
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
        expect(mockAddAccount).toHaveBeenLastCalledWith(
            expect.objectContaining({ signupPreferences: { fundingChannel: 'brlBank', paymentChannel: 'card' } })
        )
        expect(mockSend).toHaveBeenCalledTimes(1)
    })
})
