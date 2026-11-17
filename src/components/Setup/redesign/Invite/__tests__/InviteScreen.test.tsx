/** @jest-environment jsdom */
/*
 * 04 Invite: component checks from contract P2 (mono _temp/signup-redesign/r2/r9/build/contract/P2.md § 10).
 * The screen renders inside the real SetupShell (its Continue and Skip live in the shell footer), on a real
 * SetupFlowProvider; useSetupFlow is a stub so Continue's spinner (isLoading) can be driven. The debounce is the
 * screen's own: fake timers, never a mocked useDebounce. Copy comes from the catalogs by key.
 * Ported from Views/__tests__/Invite.test.tsx and Invite.preaccount.acceptance.test.tsx.
 */
import { act, fireEvent, screen, within } from '@testing-library/react'
import { useLayoutEffect, useState, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { InviteScreen } from '@/components/Setup/redesign/Invite/InviteScreen'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { EInviteType } from '@/services/services.types'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import { readInviteCode, stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import {
    controlsOf,
    eventsOf,
    loose,
    msg,
    rawMessage,
    renderInShell,
    setupState,
    type TestLocale,
} from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

const mockHandleNext = jest.fn(async () => {})
let mockIsLoading = false
const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()
const mockFetchUser = jest.fn(async () => null)
const mockApiFetch = jest.fn()
const mockFlags: Record<string, boolean | undefined> = {}

jest.mock('@/hooks/useSetupFlow', () => ({
    ...jest.requireActual('@/hooks/useSetupFlow'),
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: mockFetchUser }) }))
jest.mock('@/services/invites', () => ({
    invitesApi: {
        validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args),
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/utils/haptics', () => ({
    ...jest.requireActual('@/utils/haptics'),
    notifyHaptic: jest.fn(),
    impactHaptic: jest.fn(),
}))
// A flag PostHog has not answered takes the registered default, as the real client does.
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        onFeatureFlags: jest.fn(() => () => {}),
        isFeatureEnabled: jest.fn(
            (key: string, options?: { defaultValue?: boolean }) => mockFlags[key] ?? options?.defaultValue ?? false
        ),
        featureFlags: { hasLoadedFlags: true },
    },
}))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))

const SUGGEST_PATH = '/users/username/suggest'
const FLAG = 'signup-rollout-inviter-suggestions'
const FOUND = { success: true, attributionResolved: true }
const NOT_FOUND = { success: false, notFound: true, attributionResolved: false }
const CAMPAIGN_ONLY = { success: true, attributionResolved: false }
const CHECK_FAILED = { success: false, attributionResolved: false }

const probe = {} as { context: ReturnType<typeof useSetupFlowContext> }

function Seed({ selection, children }: { selection: string; children: ReactNode }) {
    const context = useSetupFlowContext()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        // Username (02) ran before Invite: the name is the person's own, no account yet.
        context.setUsername('newbie')
        context.setInviteSelection(selection)
        setReady(true)
        // seed once, as the earlier steps would have
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    probe.context = context
    return ready ? <>{children}</> : null
}

const renderInvite = ({ selection = '', locale = 'en' as TestLocale } = {}) =>
    renderInShell('invite', <InviteScreen />, {
        locale,
        wrap: (node) => (
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <Seed selection={selection}>{node}</Seed>
            </SetupFlowProvider>
        ),
    })

const k = (key: string, values: Record<string, string | number> = {}, locale: TestLocale = 'en') =>
    msg(`setupRedesign.${key}`, values, locale)
const field = (locale: TestLocale = 'en') => screen.getByRole('textbox', { name: k('invite.fieldLabel', {}, locale) })
const footer = () => document.querySelector('[data-setup-footer]') as HTMLElement
/** The footer's pink primary: its name gains the spinner's text while loading, so it is found by place. */
const primary = () => within(footer()).getAllByRole('button')[0]
const skip = (locale: TestLocale = 'en') => within(footer()).getByRole('button', { name: k('common.skip', {}, locale) })
const chips = () => screen.queryAllByRole('button', { name: /^@/ })
const suggestCalls = () => mockApiFetch.mock.calls.filter(([path]) => path === SUGGEST_PATH)
const controls = () => controlsOf(posthog.capture as jest.Mock)
const validated = () => eventsOf(posthog.capture as jest.Mock, ANALYTICS_EVENTS.INVITE_CODE_VALIDATED)

const type = (value: string) => fireEvent.change(field(), { target: { value } })
const advance = async (ms: number) => {
    await act(async () => {
        jest.advanceTimersByTime(ms)
    })
    await act(async () => {})
    await act(async () => {})
}
/** Type and let the 750 ms debounce and the lookup settle. */
const typeAndSettle = async (value: string) => {
    type(value)
    await advance(750)
}
const tap = async (button: HTMLElement) => {
    await act(async () => {
        fireEvent.click(button)
    })
    await act(async () => {})
}
const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}
const suggestAnswer = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
        return this
    },
})
function headerOf(init: { headers?: unknown } | undefined, name: string): string | null {
    const headers = init?.headers
    if (!headers) return null
    if (typeof (headers as { get?: unknown }).get === 'function') return (headers as Headers).get(name)
    const entries = Array.isArray(headers) ? headers : Object.entries(headers as Record<string, string>)
    const match = (entries as [string, string][]).find(([key]) => key.toLowerCase() === name)
    return match ? match[1] : null
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    disableDemoMode()
    mockIsLoading = false
    for (const key of Object.keys(mockFlags)) delete mockFlags[key]
    mockValidateInviter.mockResolvedValue(FOUND)
    mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: [] }))
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

describe('04 Invite: checking', () => {
    it('P2-10 typing "ab" makes no lookup, shows no error and keeps Continue off', async () => {
        renderInvite()
        type('ab')
        await advance(2000)
        expect(mockValidateInviter).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(primary()).toBeDisabled()
    })

    it('P2-11 the lookup waits for the 750 ms debounce: none at 749 ms, exactly one at 750 ms, with "alice"', async () => {
        renderInvite()
        type('alice')
        await advance(749)
        expect(mockValidateInviter).not.toHaveBeenCalled()
        expect(primary()).toBeDisabled()
        await advance(1)
        expect(mockValidateInviter).toHaveBeenCalledTimes(1)
        expect(mockValidateInviter).toHaveBeenCalledWith('alice')
        expect(primary()).toBeEnabled()
    })

    it('P2-12 "@Alice " is looked up as "alice"', async () => {
        renderInvite()
        await typeAndSettle('@Alice ')
        expect(mockValidateInviter.mock.calls).toEqual([['alice']])
    })

    it.each(['@Newbie', 'NEWBIE', 'newbie'])(
        'P2-13 the person’s own username (%s) says so, makes no lookup and keeps Continue off',
        async (value) => {
            renderInvite()
            await typeAndSettle(value)
            expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.isSelf')))
            expect(mockValidateInviter).not.toHaveBeenCalled()
            expect(primary()).toBeDisabled()
        }
    )

    it('P2-14 an answer for an older value, arriving after a newer edit, changes nothing and sends no event', async () => {
        const older = deferred<typeof NOT_FOUND>()
        mockValidateInviter.mockImplementation((code: string) =>
            code === 'alice' ? older.promise : Promise.resolve(FOUND)
        )
        renderInvite()
        await typeAndSettle('alice')
        type('alicia')
        await act(async () => older.resolve(NOT_FOUND))
        await act(async () => {})
        expect(screen.queryByText(loose(k('invite.notFound')))).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(validated()).toEqual([])
        await advance(750)
        expect(validated()).toEqual([{ valid: true, source: 'signup_optional_inviter' }])
        expect(setupState()).toBe('found')
    })

    it('P2-15 typing "demo" looks up "demo" and leaves demo mode off', async () => {
        renderInvite()
        await typeAndSettle('demo')
        expect(mockValidateInviter.mock.calls).toEqual([['demo']])
        expect(isDemoMode()).toBe(false)
    })
})

/** en values of `setup.signupStep.inviter*` and `setup.inviteStep.*` at origin/dev c985d250e (old Invite view). */
const DEV_INVITER_COPY = [
    'Username of the person who invited you',
    'Friend’s username',
    'We couldn’t find this user.',
    'That’s your own username.',
    'We couldn’t check this username. Try again.',
    'Continue',
    'Skip',
]

describe('04 Invite: states and copy', () => {
    it.each(['en', 'es-AR'] as const)(
        'P2-16 (%s) default: placeholder, empty help row, Continue off, Skip on, state default',
        (locale) => {
            renderInvite({ locale })
            expect(field(locale)).toHaveAttribute('placeholder', k('invite.placeholder', {}, locale))
            expect(field(locale)).toHaveValue('')
            expect(screen.queryByRole('alert')).not.toBeInTheDocument()
            expect(document.body.textContent).not.toContain(loose(k('invite.found', { name: '' }, locale)).trim())
            expect(primary()).toBeDisabled()
            expect(skip(locale)).toBeEnabled()
            expect(setupState()).toBe('default')
        }
    )

    it.each(['en', 'es-AR'] as const)(
        'P2-17 (%s) found: "Found @alice." with a no-break space before @, Continue on, friend card @alice, state found',
        async (locale) => {
            renderInvite({ locale })
            fireEvent.change(field(locale), { target: { value: 'alice' } })
            await advance(750)
            const line = k('invite.found', { name: 'alice' }, locale)
            expect(document.body.textContent).toContain(line)
            expect(line).toContain(' @alice')
            expect(primary()).toBeEnabled()
            expect(screen.getByTestId('setup-redesign-invite-friend-card')).toHaveTextContent('@alice')
            expect(setupState()).toBe('found')
        }
    )

    it('P2-18 not found: "We couldn’t find this user." as an alert, Continue off, no chips (flag off), state not-found', async () => {
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        renderInvite()
        await typeAndSettle('alice')
        expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.notFound')))
        expect(primary()).toBeDisabled()
        expect(chips()).toEqual([])
        expect(setupState()).toBe('not-found')
    })

    it('P2-19 a campaign-only answer reads as not found and stores no selection and no stash', async () => {
        mockValidateInviter.mockResolvedValue(CAMPAIGN_ONLY)
        renderInvite()
        await typeAndSettle('alice')
        expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.notFound')))
        expect(primary()).toBeDisabled()
        await tap(primary())
        expect(probe.context.inviteSelection).toBe('')
        expect(readInviteCode()).toBe('')
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it.each(['en', 'es-AR'] as const)(
        'P2-20 (%s) a failed lookup says the check did not work, never "couldn’t find", state check-failed',
        async (locale) => {
            mockValidateInviter.mockResolvedValue(CHECK_FAILED)
            renderInvite({ locale })
            fireEvent.change(field(locale), { target: { value: 'alice' } })
            await advance(750)
            expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.checkFailed', {}, locale)))
            expect(document.body.textContent).not.toContain(loose(k('invite.notFound', {}, locale)))
            expect(setupState()).toBe('check-failed')
        }
    )

    it('P2-21 after a check failure, editing to a found handle enables Continue; there is no retry button', async () => {
        mockValidateInviter.mockResolvedValueOnce(CHECK_FAILED).mockResolvedValue(FOUND)
        renderInvite()
        await typeAndSettle('alice')
        expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.checkFailed')))
        expect(screen.queryByRole('button', { name: k('common.retry') })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /retry|try again/i })).not.toBeInTheDocument()
        await typeAndSettle('bobby')
        expect(primary()).toBeEnabled()
        expect(setupState()).toBe('found')
    })

    it('P2-22 error border only on not-found, self and check-failed; found avatar only when found; clear × while typing', async () => {
        const answers: Record<string, unknown> = { nobody: NOT_FOUND, broken: CHECK_FAILED, alice: FOUND }
        mockValidateInviter.mockImplementation(async (code: string) => answers[code])
        renderInvite()
        const invalid = () => field().getAttribute('aria-invalid') === 'true'
        const avatar = () => screen.queryByTestId('setup-redesign-invite-found-avatar')
        const clear = () => screen.queryByRole('button', { name: k('invite.clearAria') })

        expect([invalid(), !!avatar()]).toEqual([false, false])
        type('alic')
        expect([invalid(), !!avatar(), !!clear()]).toEqual([false, false, true])
        for (const [value, state] of [
            ['nobody', 'not-found'],
            ['newbie', 'self'],
            ['broken', 'check-failed'],
        ]) {
            await typeAndSettle(value)
            expect(setupState()).toBe(state)
            expect([invalid(), !!avatar()]).toEqual([true, false])
        }
        await typeAndSettle('alice')
        expect(setupState()).toBe('found')
        expect([invalid(), !!avatar()]).toEqual([false, true])
    })

    it('P2-23 the screen shows the redesign copy, never the old view’s inviter copy', async () => {
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        renderInvite()
        const redesign = new Set(
            Object.values(rawMessage('setupRedesign.invite') as Record<string, string>).map((value) => loose(value))
        )
        // The old view's keys (`setup.signupStep.inviter*`, `setup.inviteStep.*`) left the catalogs with the old view,
        // so the check reads their en values as pinned at origin/dev c985d250e.
        const dev = DEV_INVITER_COPY.filter((value): value is string => typeof value === 'string')
            .map((value) => loose(value))
            .filter(
                (value) =>
                    !redesign.has(value) && value !== loose(k('common.continue')) && value !== loose(k('common.skip'))
            )
        expect(dev.length).toBeGreaterThan(0)
        const shown = () =>
            loose(
                [
                    document.body.textContent ?? '',
                    ...Array.from(document.querySelectorAll('[placeholder]')).map((el) =>
                        el.getAttribute('placeholder')
                    ),
                ].join(' ')
            )
        for (const value of dev) expect(shown()).not.toContain(value)
        await typeAndSettle('nobody')
        for (const value of dev) expect(shown()).not.toContain(value)
    })
})

describe('04 Invite: Continue and Skip', () => {
    it('P2-24 Continue on a found "alice" stores it, advances once, accepts nothing and fetches no user', async () => {
        renderInvite()
        await typeAndSettle('@Alice')
        await tap(primary())
        expect(probe.context.inviteSelection).toBe('alice')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
        expect(readInviteCode()).toBe('')
    })

    it('R2-10 Enter in the field acts as Continue: nothing while it is off, one advance once "alice" is found', async () => {
        renderInvite()
        const enter = async () => {
            await act(async () => {
                fireEvent.keyDown(field(), { key: 'Enter' })
            })
            await act(async () => {})
        }
        expect(field()).toHaveAttribute('enterkeyhint', 'go')
        type('alice')
        await enter()
        expect(mockHandleNext).not.toHaveBeenCalled()
        await advance(750)
        expect(primary()).toBeEnabled()
        await enter()
        expect(probe.context.inviteSelection).toBe('alice')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P2-25 Continue does nothing while changing, checking or failed; while loading it spins and Skip is off', async () => {
        const pending = deferred<typeof FOUND>()
        mockValidateInviter.mockImplementationOnce(async () => CHECK_FAILED)
        const view = renderInvite()
        // failed
        await typeAndSettle('alice')
        await tap(primary())
        // changing (inside the debounce)
        type('alicia')
        await tap(primary())
        // checking (lookup in flight)
        mockValidateInviter.mockImplementationOnce(() => pending.promise)
        await advance(750)
        expect(primary()).toBeDisabled()
        await tap(primary())
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(probe.context.inviteSelection).toBe('')

        await act(async () => pending.resolve(FOUND))
        await act(async () => {})
        expect(primary()).toBeEnabled()
        mockIsLoading = true
        // a new element, so the screen re-renders and reads isLoading again
        view.rerenderInShell(<InviteScreen />)
        expect(primary()).toBeDisabled()
        expect(within(primary()).getByRole('status')).toBeInTheDocument()
        expect(skip()).toBeDisabled()
        expect(setupState()).toBe('continuing')
        await tap(primary())
        await tap(skip())
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('P2-26 Skip after choosing "alice" empties the selection, advances and accepts nothing', async () => {
        renderInvite({ selection: 'alice' })
        expect(field()).toHaveValue('alice')
        await tap(skip())
        expect(probe.context.inviteSelection).toBe('')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })

    it('P2-27 Skip never clears an invite-link stash or a tracked-link stash', async () => {
        stashInvite('bob', EInviteType.PAYMENT_LINK)
        const first = renderInvite()
        await tap(skip())
        expect(readInviteCode()).toBe('bob')
        first.unmount()

        localStorage.clear()
        sessionStorage.clear()
        stashAcquisitionInvite('alice')
        renderInvite()
        await tap(skip())
        expect(readInviteCode()).toBe('alice')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })

    it.each(['en', 'es-AR'] as const)(
        'P2-28 (%s) Skip is a button in the footer’s link slot under Continue, not a white secondary button',
        (locale) => {
            renderInvite({ locale })
            const button = skip(locale)
            expect(button.tagName).toBe('BUTTON')
            expect(primary().compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
            // a footer with a secondary button stacks as '2' or '3'; a primary plus a link slot does not
            expect(['1', 'n']).toContain(footer().getAttribute('data-stack'))
        }
    )
})

describe('04 Invite: analytics', () => {
    it('P2-29 edit → miss → own name → found → Continue sends exactly these controls, all on screen invite', async () => {
        mockValidateInviter.mockResolvedValueOnce(NOT_FOUND).mockResolvedValue(FOUND)
        renderInvite()
        await typeAndSettle('nobodyhere')
        await typeAndSettle('newbie')
        await typeAndSettle('alice')
        await tap(primary())
        expect(controls()).toEqual([
            'inviter_username:change',
            'inviter_username:error:not_found',
            'inviter_username:error:self',
            'continue:tap',
        ])
        const screens = eventsOf(posthog.capture as jest.Mock, ANALYTICS_EVENTS.CONTROL_USED).map(
            (properties) => properties.screen_id
        )
        expect(new Set(screens)).toEqual(new Set(['invite']))
    })

    it('P2-30 the same miss twice, with an edit between, reports not_found twice', async () => {
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        renderInvite()
        await typeAndSettle('nobodyhere')
        await typeAndSettle('nobodyelse')
        expect(controls().filter((control) => control === 'inviter_username:error:not_found')).toHaveLength(2)
    })

    it('P2-31 Skip sends skip:tap and signup_invite_skipped with no properties', async () => {
        renderInvite()
        await tap(skip())
        expect(controls()).toEqual(['skip:tap'])
        const skipped = (posthog.capture as jest.Mock).mock.calls.filter(
            ([event]) => event === ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED
        )
        expect(skipped).toHaveLength(1)
        expect(skipped[0][1]).toBeUndefined()
    })

    it('P2-32 each current lookup sends invite_code_validated {valid, source}; the own name sends none', async () => {
        mockValidateInviter.mockResolvedValueOnce(NOT_FOUND).mockResolvedValue(FOUND)
        renderInvite()
        await typeAndSettle('nobody')
        await typeAndSettle('newbie')
        await typeAndSettle('alice')
        expect(validated()).toEqual([
            { valid: false, source: 'signup_optional_inviter' },
            { valid: true, source: 'signup_optional_inviter' },
        ])
    })

    it('P2-33 clear × sends inviter_username_clear:tap; no event property holds a typed, found or suggested handle', async () => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockImplementation(async (code: string) => (code === 'martn' ? NOT_FOUND : FOUND))
        mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: ['martin', 'marti9'] }))
        renderInvite()
        await typeAndSettle('martn')
        await tap(screen.getByRole('button', { name: '@martin' }))
        await advance(750)
        type('alicex')
        await tap(screen.getByRole('button', { name: k('invite.clearAria') }))
        expect(field()).toHaveValue('')
        expect(controls()).toContain('inviter_username_clear:tap')
        const everything = JSON.stringify((posthog.capture as jest.Mock).mock.calls)
        for (const handle of ['martn', 'martin', 'marti9', 'alicex']) expect(everything).not.toContain(handle)
    })
})

describe('04 Invite: "Did you mean" chips (flag signup-rollout-inviter-suggestions)', () => {
    it('P2-35 flag off (registered default, not bypassed off prod): a confirmed miss sends no suggest request and shows no chip', async () => {
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        renderInvite()
        await typeAndSettle('martn')
        await advance(2000)
        expect(suggestCalls()).toEqual([])
        expect(chips()).toEqual([])
        expect(controls().some((control) => control.startsWith('inviter_suggestion'))).toBe(false)
    })

    it('P2-36 flag on, three names back: exactly two chips after the lead, open event with 2, request body and hold header', async () => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: ['martin', 'marti9', 'marta'] }))
        renderInvite()
        await typeAndSettle('Martn')
        expect(chips().map((chip) => chip.textContent)).toEqual(['@martin', '@marti9'])
        expect(loose(screen.getByTestId('setup-redesign-invite-suggestions').textContent ?? '')).toBe(
            loose(k('invite.suggestTwo', { a: '@martin', b: '@marti9' }))
        )
        expect(setupState()).toBe('not-found')
        expect(controls()).toContain('inviter_suggestion:open:2')
        expect(suggestCalls()).toHaveLength(1)
        const [, init] = suggestCalls()[0] as [string, { method?: string; body?: string; headers?: unknown }]
        expect((init.method ?? '').toUpperCase()).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual({ username: 'martn' })
        expect(headerOf(init, 'x-username-hold')).toEqual(expect.stringMatching(/\S+/))
    })

    it('P2-36 flag on, one name back: one chip after the one-name lead, open event with 1', async () => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: ['martin'] }))
        renderInvite()
        await typeAndSettle('martn')
        expect(chips().map((chip) => chip.textContent)).toEqual(['@martin'])
        expect(loose(screen.getByTestId('setup-redesign-invite-suggestions').textContent ?? '')).toBe(
            loose(k('invite.suggestOne', { a: '@martin' }))
        )
        expect(controls()).toContain('inviter_suggestion:open:1')
    })

    it.each([
        ['a check failure', 'martn', CHECK_FAILED],
        ['a campaign-only answer', 'martn', CAMPAIGN_ONLY],
        ['the own name', 'newbie', FOUND],
    ])('P2-37 flag on: no suggest request after %s', async (_label, value, answer) => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockResolvedValue(answer)
        mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: ['martin'] }))
        renderInvite()
        await typeAndSettle(value)
        await advance(2000)
        expect(suggestCalls()).toEqual([])
        expect(chips()).toEqual([])
    })

    it('P2-37 flag on: no suggest request while typing', async () => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockResolvedValue(NOT_FOUND)
        renderInvite()
        type('mar')
        await advance(100)
        type('martn')
        await advance(700)
        expect(suggestCalls()).toEqual([])
    })

    it.each([
        ['a 429', () => mockApiFetch.mockResolvedValue(suggestAnswer(429, { error: 'quota' }))],
        ['a network failure', () => mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'))],
    ])(
        'P2-37 flag on: %s from the suggest route shows state 5 with no chips and no extra error',
        async (_l, arrange) => {
            mockFlags[FLAG] = true
            mockValidateInviter.mockResolvedValue(NOT_FOUND)
            arrange()
            renderInvite()
            await typeAndSettle('martn')
            await advance(1000)
            expect(setupState()).toBe('not-found')
            expect(chips()).toEqual([])
            expect(screen.getAllByRole('alert')).toHaveLength(1)
            expect(screen.getByRole('alert')).toHaveTextContent(loose(k('invite.notFound')))
            expect(controls()).toEqual(['inviter_username:change', 'inviter_username:error:not_found'])
        }
    )

    it('P2-38 flag on: a chip tap fills "martin" without @, clears error and chips, then Continue waits for its own check', async () => {
        mockFlags[FLAG] = true
        mockValidateInviter.mockImplementation(async (code: string) => (code === 'martin' ? FOUND : NOT_FOUND))
        mockApiFetch.mockResolvedValue(suggestAnswer(200, { suggestions: ['martin', 'marti9'] }))
        renderInvite()
        await typeAndSettle('martn')
        await tap(screen.getByRole('button', { name: '@martin' }))
        expect(field()).toHaveValue('martin')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(chips()).toEqual([])
        expect(controls()).toContain('inviter_suggestion:tap:1')
        await advance(749)
        expect(primary()).toBeDisabled()
        await advance(1)
        expect(mockValidateInviter).toHaveBeenLastCalledWith('martin')
        expect(primary()).toBeEnabled()
        expect(setupState()).toBe('found')
    })
})
