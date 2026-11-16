/** @jest-environment jsdom */
/*
 * 03 Passkey (step `passkey`), component checks C-34 … C-58 of build/contract/C.md.
 *
 * The screen is rendered inside the real SetupShell (its footer holds Create passkey, the terms line, Log in and
 * the failure screens' buttons). `useSignupPasskey` is replaced by a plain object per state, with the two additive
 * fields of C.md § 4.8 (`inlineErrorCode`, `helpReason`); the hook's own behaviour is checked in
 * src/features/setup/__tests__/redesign-passkey-hook.test.tsx. Copy comes from the real catalogs by key.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import posthog from 'posthog-js'
import type { ReactElement } from 'react'
import { PasskeyScreen } from '@/components/Setup/redesign/Passkey/PasskeyScreen'
import { SetupDocsProvider, type SetupDocuments } from '@/components/Setup/components/SetupDocsDrawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'
import {
    BANNED_COPY,
    controlsOf,
    loose,
    msg,
    rawMessage,
    renderInShell,
    setupState,
    type TestLocale,
} from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

const mockSetScreenId = jest.fn()
const mockHandleNext = jest.fn()
const mockSetRefusedUsername = jest.fn()
const mockReserveUsername = jest.fn()
let mockUsername = 'luckyotter'

type PasskeyState = {
    claim: jest.Mock
    isClaiming: boolean
    preflightWarning: string | null
    inlineError: string | null
    inlineErrorCode: 'cancelled' | null
    usernameTaken: boolean
    logIn: jest.Mock
    isLoggingIn: boolean
    helpErrorName: string | null
    helpReason: 'android-setup' | 'ios-not-saved' | 'private-mode' | 'error-name' | null
    isHelpOpen: boolean
    closeHelp: jest.Mock
    retryFromHelp: jest.Mock
    isProviderUnsupportedOpen: boolean
    providerUnsupportedPlatform: 'android-app' | 'other'
    closeProviderUnsupported: jest.Mock
    retryFromProviderUnsupported: jest.Mock
    signUpInBrowser: jest.Mock
    deviceType: 'android' | 'ios' | 'web'
}
const mockPasskey = {} as PasskeyState
const BASE = (): PasskeyState => ({
    claim: jest.fn(async () => {}),
    isClaiming: false,
    preflightWarning: null,
    inlineError: null,
    inlineErrorCode: null,
    usernameTaken: false,
    logIn: jest.fn(async () => {}),
    isLoggingIn: false,
    helpErrorName: null,
    helpReason: null,
    isHelpOpen: false,
    closeHelp: jest.fn(),
    retryFromHelp: jest.fn(),
    isProviderUnsupportedOpen: false,
    providerUnsupportedPlatform: 'other',
    closeProviderUnsupported: jest.fn(),
    retryFromProviderUnsupported: jest.fn(),
    signUpInBrowser: jest.fn(async () => {}),
    deviceType: 'android',
})

jest.mock('@/features/setup/useSignupPasskey', () => ({ useSignupPasskey: () => mockPasskey }))
jest.mock('@/features/setup/username-reservation', () => ({
    ...jest.requireActual('@/features/setup/username-reservation'),
    reserveUsername: (username: string) => mockReserveUsername(username),
}))
jest.mock('@/hooks/useSetupFlow', () => ({
    postRegistrationScreen: () => 'notification-email',
    useSetupFlow: () => ({ isLoading: false, handleNext: mockHandleNext, setScreenId: mockSetScreenId }),
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    ...jest.requireActual('@/features/setup/SetupFlowContext'),
    useOptionalSetupFlow: () => null,
    useSetupFlowContext: () => ({
        username: mockUsername,
        setRefusedUsername: mockSetRefusedUsername,
        refusedUsername: null,
        registrationInProgress: false,
    }),
}))
// art only: the Lottie player has nothing to draw in jsdom
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), onFeatureFlags: jest.fn(() => () => {}), isFeatureEnabled: jest.fn(() => false) },
}))

const doc = (title: string) => ({ title, content: <p>{title} body</p> })
const localized = (title: string) => ({
    en: doc(title),
    'es-419': doc(title),
    'es-ar': doc(title),
    'pt-br': doc(title),
})
const DOCUMENTS: SetupDocuments = {
    terms: doc('Terms doc'),
    privacy: doc('Privacy doc'),
    'account-recovery': localized('Account recovery'),
    passkeys: localized('Passkeys guide'),
}
const withDocs = (node: ReactElement) => <SetupDocsProvider documents={DOCUMENTS}>{node}</SetupDocsProvider>

const show = (patch: Partial<PasskeyState> = {}, locale: TestLocale = 'en') => {
    Object.assign(mockPasskey, patch)
    return renderInShell('passkey', <PasskeyScreen />, {
        locale,
        showBackButton: true,
        onBack: () => void dispatchBackPress(),
        wrap: withDocs,
    })
}
const P = (key: string, values?: Record<string, string | number>, locale?: TestLocale) =>
    msg(`setupRedesign.passkey.${key}`, values, locale)
/** The visible text inside one rich-text tag of a catalog string, e.g. "terms" in `<terms>terms</terms>`. */
const tagText = (key: string, tag: string, locale: TestLocale = 'en') => {
    const raw = rawMessage(key, locale)
    const match = typeof raw === 'string' ? new RegExp(`<${tag}>(.*?)</${tag}>`).exec(raw) : null
    if (!match) throw new Error(`catalog ${locale} "${key}" has no <${tag}> tag`)
    return match[1]
}
const exact = (text: string) =>
    new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \u00a0]/g, '[ \\u00a0]')}$`)
const button = (label: string) => screen.getByRole('button', { name: exact(loose(label)) })
const createButton = () => screen.getByRole('button', { name: new RegExp(loose(P('s1.cta'))) })
const controls = () => controlsOf(posthog.capture as jest.Mock)
const flush = () => act(async () => {})
const back = async () => {
    fireEvent.click(screen.getByRole('button', { name: msg('setup.navigation.goBack') }))
    await flush()
}
const listItems = () =>
    within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '')
const alertText = () => loose(screen.getByRole('alert').textContent ?? '')
const bodyText = () => document.body.textContent ?? ''

beforeEach(() => {
    jest.clearAllMocks()
    resetBackHandlersForTests()
    for (const key of Object.keys(mockPasskey)) delete (mockPasskey as Record<string, unknown>)[key]
    Object.assign(mockPasskey, BASE())
    mockUsername = 'luckyotter'
    mockReserveUsername.mockResolvedValue('reserved')
})

describe('03 Passkey — hero states', () => {
    it('C-34 default: headline, lead, two points, Create passkey, terms line, mini sheet; no Learn more', async () => {
        show()
        await flush()

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(P('s1.title')))
        expect(screen.getByText(loose(P('s1.lead')), { normalizer: loose })).toBeInTheDocument()
        const points = screen.getByTestId('passkey-points')
        expect(points).toHaveTextContent(loose(P('s1.p1')))
        expect(points).toHaveTextContent(loose(P('s1.p2')))
        expect(createButton()).toBeEnabled()
        const terms = screen.getByTestId('passkey-terms')
        expect(loose(terms.textContent ?? '')).toBe(loose(P('terms')))
        expect(
            within(terms).getByRole('button', { name: tagText('setupRedesign.passkey.terms', 'terms') })
        ).toBeInTheDocument()
        expect(
            within(terms).getByRole('button', {
                name: exact(loose(tagText('setupRedesign.passkey.terms', 'privacy'))),
            })
        ).toBeInTheDocument()
        const sheet = screen.getByTestId('passkey-mini-sheet')
        for (const text of [P('ask'), '@luckyotter', P('yes'), P('no')]) expect(sheet).toHaveTextContent(loose(text))
        expect(screen.queryByText(new RegExp(msg('setup.passkey.learnMore'), 'i'))).not.toBeInTheDocument()
        expect(screen.queryByText(/learn more/i)).not.toBeInTheDocument()
        for (const banned of BANNED_COPY) expect(bodyText()).not.toMatch(banned)
        expect(setupState()).toBe('default')
    })

    it('C-35 the terms and privacy links open their doc drawers, reported from screen_id passkey', async () => {
        show()
        await flush()
        fireEvent.click(screen.getByRole('button', { name: tagText('setupRedesign.passkey.terms', 'terms') }))
        expect(await screen.findByRole('dialog')).toHaveTextContent('Terms doc')
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        // The DS drawer stays mounted, closed and inert, through its exit animation (Global/Drawer), so "closed"
        // is data-state="closed" or gone.
        await waitFor(() => {
            const dialog = screen.queryByRole('dialog')
            expect(dialog === null || dialog.getAttribute('data-state') === 'closed').toBe(true)
        })
        // Until that exit animation ends the modal keeps the page aria-hidden, hence `hidden: true` for the link.
        fireEvent.click(
            screen.getByRole('button', {
                name: exact(loose(tagText('setupRedesign.passkey.terms', 'privacy'))),
                hidden: true,
            })
        )
        await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Privacy doc'))
        expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open')

        expect(controls()).toEqual(expect.arrayContaining(['terms_doc:open', 'terms_doc:dismiss', 'privacy_doc:open']))
        const opens = (posthog.capture as jest.Mock).mock.calls.filter(
            ([event, props]) => event === ANALYTICS_EVENTS.CONTROL_USED && /_doc$/.test(props.control)
        )
        expect(opens.length).toBeGreaterThan(0)
        for (const [, props] of opens) expect(props.screen_id).toBe('passkey')
    })

    it.each(['taken', 'refused', 'invalid'] as const)(
        'C-36 a mount reservation answering %s reports it and returns to 02 (refused also marks the name)',
        async (result) => {
            mockReserveUsername.mockResolvedValue(result)
            show()
            await flush()
            expect(mockReserveUsername.mock.calls).toEqual([['luckyotter']])
            expect(controls()).toEqual([`username:error:${result}`])
            expect(mockSetScreenId).toHaveBeenCalledWith('signup')
            expect(mockSetRefusedUsername.mock.calls).toEqual(result === 'refused' ? [['luckyotter']] : [])
            expect(mockPasskey.claim).not.toHaveBeenCalled()
        }
    )

    it('C-36 refreshes the reservation once per name and ignores a late collision once the tap started', async () => {
        let resolve!: (value: string) => void
        mockReserveUsername.mockReturnValue(new Promise((done) => (resolve = done)))
        const view = show()
        view.rerenderInShell(<PasskeyScreen />)
        Object.assign(mockPasskey, { isClaiming: true })
        view.rerenderInShell(<PasskeyScreen />)
        await act(async () => resolve('taken'))
        expect(mockReserveUsername).toHaveBeenCalledTimes(1)
        expect(mockSetScreenId).not.toHaveBeenCalled()
        expect(setupState()).toBe('prompt')
    })

    it.each(['kim', '9lucky', 'has.dot', 'waytoolongname'])(
        'C-37 a stored name %s that fails the username pattern returns to 02 with no ceremony',
        async (name) => {
            mockUsername = name
            show()
            await flush()
            expect(mockSetScreenId).toHaveBeenCalledWith('signup')
            expect(controls()).toContain('username:error:invalid')
            expect(mockPasskey.claim).not.toHaveBeenCalled()
        }
    )

    it('C-38 a tap reports create_passkey and claims once; while claiming: spinner, disabled, terms kept, prompt state, no in-app sheet', async () => {
        const view = show()
        await flush()
        fireEvent.click(createButton())
        expect(controls()).toEqual(['create_passkey:tap'])
        expect(mockPasskey.claim).toHaveBeenCalledTimes(1)

        Object.assign(mockPasskey, { isClaiming: true })
        view.rerenderInShell(<PasskeyScreen />)
        expect(createButton()).toBeDisabled()
        expect(within(createButton()).getByRole('status')).toBeInTheDocument()
        fireEvent.click(createButton())
        expect(mockPasskey.claim).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('passkey-terms')).toBeInTheDocument()
        expect(setupState()).toBe('prompt')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

describe('03 Passkey — inline errors', () => {
    it('C-43 a cancel shows the cancelled callout in place of the points, button still enabled (en)', async () => {
        show({ inlineError: msg('setup.passkey.notCompleted'), inlineErrorCode: 'cancelled' })
        await flush()
        expect(screen.getByTestId('passkey-inline-error')).toHaveAttribute('role', 'alert')
        expect(alertText()).toBe(loose(P('cancelled')))
        expect(screen.queryByTestId('passkey-points')).not.toBeInTheDocument()
        expect(screen.queryByText(loose(P('s1.p1')))).not.toBeInTheDocument()
        expect(createButton()).toBeEnabled()
        expect(setupState()).toBe('error-inline')
    })

    it('C-43 a cancel shows the es-AR cancelled copy', async () => {
        show({ inlineError: msg('setup.passkey.notCompleted', {}, 'es-AR'), inlineErrorCode: 'cancelled' }, 'es-AR')
        await flush()
        expect(alertText()).toBe(loose(P('cancelled', {}, 'es-AR')))
    })

    it.each([
        'tookTooLong',
        'notReady',
        'interrupted',
        'settling',
        'stillOpen',
        'deviceState',
        'rateLimited',
        'serverUnreachable',
        'notAvailable',
    ])('C-44 the hook’s %s message shows unchanged in the callout', async (key) => {
        const text = msg(`setup.passkey.${key}`)
        show({ inlineError: text })
        await flush()
        expect(alertText()).toBe(loose(text))
        expect(screen.queryByTestId('passkey-points')).not.toBeInTheDocument()
        expect(createButton()).toBeEnabled()
        expect(setupState()).toBe('error-inline')
    })

    it('C-45 a preflight warning set on mount shows the callout before any tap', async () => {
        show({ preflightWarning: msg('setup.passkey.unsupported') })
        await flush()
        expect(alertText()).toBe(loose(msg('setup.passkey.unsupported')))
        expect(setupState()).toBe('error-inline')
        expect(mockPasskey.claim).not.toHaveBeenCalled()
    })
})

describe('03 Passkey — taken', () => {
    it('C-46 the taken screen: headline with @name, lead, Pick another username first, Log in second; no points, no terms', async () => {
        show({ usernameTaken: true })
        await flush()
        expect(setupState()).toBe('taken')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            loose(P('takenTitle', { name: '@luckyotter' }))
        )
        expect(screen.getByText(loose(P('takenLead')), { normalizer: loose })).toBeInTheDocument()
        const pick = button(P('takenCta'))
        const logIn = button(P('logIn'))
        expect(pick.compareDocumentPosition(logIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.queryByTestId('passkey-points')).not.toBeInTheDocument()
        expect(screen.queryByTestId('passkey-terms')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: new RegExp(loose(P('s1.cta'))) })).not.toBeInTheDocument()
    })

    it('C-47 Pick another username jumps to 02 and reports taken_pick_another; it does not use the shell back', async () => {
        const onBackSpy = jest.fn()
        Object.assign(mockPasskey, { usernameTaken: true })
        renderInShell('passkey', <PasskeyScreen />, { showBackButton: true, onBack: onBackSpy, wrap: withDocs })
        await flush()
        fireEvent.click(button(P('takenCta')))
        expect(controls()).toContain('taken_pick_another:tap')
        expect(mockSetScreenId.mock.calls).toEqual([['signup']])
        expect(onBackSpy).not.toHaveBeenCalled()
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('C-48 Log in reports log_in and logs in once; it spins while logging in; a login error shows under the lead', async () => {
        const view = show({ usernameTaken: true })
        await flush()
        fireEvent.click(button(P('logIn')))
        expect(controls()).toContain('log_in:tap')
        expect(mockPasskey.logIn).toHaveBeenCalledTimes(1)

        Object.assign(mockPasskey, { isLoggingIn: true })
        view.rerenderInShell(<PasskeyScreen />)
        // While logging in the DS button's name gains its spinner's "Loading..." label, so match the label's end.
        const logInBusy = screen.getByRole('button', { name: (name) => loose(name).endsWith(loose(P('logIn'))) })
        expect(within(logInBusy).getByRole('status')).toBeInTheDocument()
        expect(logInBusy).toBeDisabled()

        Object.assign(mockPasskey, { isLoggingIn: false, inlineError: msg('setup.passkey.loginError') })
        view.rerenderInShell(<PasskeyScreen />)
        expect(setupState()).toBe('taken')
        expect(alertText()).toBe(loose(msg('setup.passkey.loginError')))
        const lead = screen.getByText(loose(P('takenLead')), { normalizer: loose })
        expect(lead.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('C-48 after ACCOUNT_DELETED (taken off) the hero shows the choose-another-username callout', async () => {
        show({ usernameTaken: false, inlineError: msg('setup.passkey.accountDeletedChooseUsername') })
        await flush()
        expect(setupState()).toBe('error-inline')
        expect(alertText()).toBe(loose(msg('setup.passkey.accountDeletedChooseUsername')))
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(P('s1.title')))
    })
})

describe('03 Passkey — failure screens', () => {
    const androidSetup = (): Partial<PasskeyState> => ({
        helpErrorName: 'NotAllowedError',
        helpReason: 'android-setup',
        isHelpOpen: true,
        deviceType: 'android',
    })
    const iosNotSaved = (): Partial<PasskeyState> => ({
        helpErrorName: 'PasskeyNotSaved',
        helpReason: 'ios-not-saved',
        isHelpOpen: true,
        deviceType: 'ios',
    })

    it('C-49 android setup: title, lead, three steps in order, Try again, support; passkey_help:open once per opening', async () => {
        const view = show(androidSetup())
        await flush()
        expect(setupState()).toBe('failed-android')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(P('failedTitle')))
        expect(screen.getByText(loose(P('failedLead')), { normalizer: loose })).toBeInTheDocument()
        expect(screen.getByRole('list').tagName).toBe('OL')
        expect(listItems().map(loose)).toEqual([P('android1'), P('android2'), P('android3')].map(loose))
        expect(button(msg('setupRedesign.common.retry'))).toBeEnabled()
        expect(bodyText().replace(/\u00a0/g, ' ')).toContain(loose(msg('setupRedesign.common.support')))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        view.rerenderInShell(<PasskeyScreen />)
        expect(controls()).toEqual(['passkey_help:open'])
        Object.assign(mockPasskey, { isHelpOpen: false, helpReason: null, helpErrorName: null })
        view.rerenderInShell(<PasskeyScreen />)
        Object.assign(mockPasskey, androidSetup())
        view.rerenderInShell(<PasskeyScreen />)
        expect(controls()).toEqual(['passkey_help:open', 'passkey_help:open'])
    })

    it('C-50 iOS not saved: the three iOS steps, verbatim with their no-break spaces', async () => {
        show(iosNotSaved())
        await flush()
        expect(setupState()).toBe('failed-ios')
        expect(listItems()).toEqual([P('ios1'), P('ios2'), P('ios3')])
        expect(P('ios2')).toMatch(/Sync\u00a0this\u00a0iPhone/)
        expect(P('ios3')).toMatch(/Face\u00a0ID/)
    })

    it('C-51 on a failed screen: Try again retries, support links out, Back closes the screen and keeps the step', async () => {
        const view = show(androidSetup())
        await flush()
        fireEvent.click(button(msg('setupRedesign.common.retry')))
        expect(mockPasskey.retryFromHelp).toHaveBeenCalledTimes(1)
        const support = screen.getByRole('link', {
            name: exact(loose(tagText('setupRedesign.common.support', 'link'))),
        })
        expect(support).toHaveAttribute('href', 'https://peanut.me/support')
        fireEvent.click(support)
        await back()
        expect(controls()).toEqual([
            'passkey_help:open',
            'passkey_help_retry:tap',
            'passkey_help_support:tap',
            'back:tap',
            'passkey_help:dismiss',
        ])
        expect(mockPasskey.closeHelp).toHaveBeenCalledTimes(1)
        expect(mockSetScreenId).not.toHaveBeenCalled()
        expect(mockHandleNext).not.toHaveBeenCalled()

        Object.assign(mockPasskey, { isHelpOpen: false })
        view.rerenderInShell(<PasskeyScreen />)
        expect(setupState()).toBe('default')
    })

    it.each([
        ['private-mode', 'NotAllowedError', 'notAllowed'],
        ['error-name', 'NotReadableError', 'notReadable'],
        ['error-name', 'InvalidStateError', 'invalidState'],
    ] as const)(
        'C-52 %s (%s) opens dev’s help drawer over default, with dev’s title and controls',
        async (helpReason, helpErrorName, title) => {
            show({ helpReason, helpErrorName, isHelpOpen: true, deviceType: 'web' })
            await flush()
            const dialog = await screen.findByRole('dialog')
            expect(dialog).toHaveTextContent(loose(msg(`setup.passkey.help.titles.${title}`)))
            expect(setupState()).toBe('default')
            fireEvent.click(within(dialog).getByRole('button', { name: /retry/i }))
            fireEvent.click(within(dialog).getByRole('link', { name: /still stuck/i }))
            fireEvent.keyDown(dialog, { key: 'Escape' })
            await waitFor(() => expect(controls()).toContain('passkey_help:dismiss'))
            expect(controls()).toEqual([
                'passkey_help:open',
                'passkey_help_retry:tap',
                'passkey_help_support:tap',
                'passkey_help:dismiss',
            ])
        }
    )

    const cannot = (): Partial<PasskeyState> => ({
        isProviderUnsupportedOpen: true,
        providerUnsupportedPlatform: 'android-app',
        deviceType: 'android',
    })

    it('C-53 cannot-create: title, two Settings steps, Try again, browser button, support; each action reported; Back closes', async () => {
        show(cannot())
        await flush()
        expect(setupState()).toBe('cannot-create')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(P('cannotTitle')))
        expect(listItems().map(loose)).toEqual([P('cannot1'), P('cannot2')].map(loose))
        const retry = button(msg('setupRedesign.common.retry'))
        const browser = button(P('browser'))
        expect(retry.compareDocumentPosition(browser) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        fireEvent.click(retry)
        fireEvent.click(browser)
        fireEvent.click(
            screen.getByRole('link', { name: exact(loose(tagText('setupRedesign.common.support', 'link'))) })
        )
        await back()
        expect(controls()).toEqual([
            'passkey_provider_retry:tap',
            'passkey_provider_web_signup:tap',
            'passkey_provider_support:tap',
            'back:tap',
            'passkey_provider:dismiss',
        ])
        expect(mockPasskey.retryFromProviderUnsupported).toHaveBeenCalledTimes(1)
        expect(mockPasskey.signUpInBrowser).toHaveBeenCalledTimes(1)
        expect(mockPasskey.closeProviderUnsupported).toHaveBeenCalledTimes(1)
        expect(mockSetScreenId).not.toHaveBeenCalled()
    })

    it('C-55 cannot-create-other: one lead, Try again, support; no browser button', async () => {
        show({ isProviderUnsupportedOpen: true, providerUnsupportedPlatform: 'other', deviceType: 'ios' })
        await flush()
        expect(setupState()).toBe('cannot-create-other')
        expect(screen.getByText(loose(P('cannotOther')), { normalizer: loose })).toBeInTheDocument()
        expect(button(msg('setupRedesign.common.retry'))).toBeEnabled()
        expect(
            screen.getByRole('link', { name: exact(loose(tagText('setupRedesign.common.support', 'link'))) })
        ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: exact(loose(P('browser'))) })).not.toBeInTheDocument()
    })

    it.each([
        ['failed-android', androidSetup],
        ['failed-ios', iosNotSaved],
        ['taken', () => ({ usernameTaken: true })],
        ['cannot-create', cannot],
        [
            'cannot-create-other',
            () => ({ isProviderUnsupportedOpen: true, providerUnsupportedPlatform: 'other' as const }),
        ],
    ] as const)('C-56 %s never advances the step', async (state, patch) => {
        show(patch())
        await flush()
        await act(async () => {})
        expect(setupState()).toBe(state)
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockSetScreenId).not.toHaveBeenCalled()
    })

    it('C-57 taken wins over an open unsupported-provider screen', async () => {
        show({ ...cannot(), usernameTaken: true })
        await flush()
        expect(setupState()).toBe('taken')
        expect(screen.queryByRole('button', { name: exact(loose(P('browser'))) })).not.toBeInTheDocument()
    })
})

describe('03 Passkey — es-AR', () => {
    it('C-58 headline, terms line, taken buttons and browser button in es-AR', async () => {
        const view = show({}, 'es-AR')
        await flush()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(P('s1.title', {}, 'es-AR')))
        expect(loose(screen.getByTestId('passkey-terms').textContent ?? '')).toBe(loose(P('terms', {}, 'es-AR')))
        view.unmount()

        const taken = show({ usernameTaken: true }, 'es-AR')
        await flush()
        expect(button(P('takenCta', {}, 'es-AR'))).toBeInTheDocument()
        expect(button(P('logIn', {}, 'es-AR'))).toBeInTheDocument()
        taken.unmount()

        show(
            { usernameTaken: false, isProviderUnsupportedOpen: true, providerUnsupportedPlatform: 'android-app' },
            'es-AR'
        )
        await flush()
        expect(button(P('browser', {}, 'es-AR'))).toBeInTheDocument()
    })
})
