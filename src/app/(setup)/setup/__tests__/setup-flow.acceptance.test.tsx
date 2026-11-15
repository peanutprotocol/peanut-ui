jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance tests for the reordered signup at the page level: the real
 * (setup) layout (step list), the real /setup page (entry, resume, analytics)
 * and the real flow context, with only network, auth and chrome mocked
 * (spec: signup-reorder-spec.md).
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - New screen id 'passkey' between 'invite' and 'notification-email'.
 * - The anonymous draft lives in web storage (sessionStorage on web, localStorage
 *   on native). Tests seed it by answering in
 *   the flow and "reload" by unmounting and mounting again; they never name
 *   its key. The versioning test looks for a stored JSON object with a
 *   numeric `version` field (as signup-progress uses) written during the
 *   flow.
 * - A registered old-order account is { username, no PEANUT_WALLET } and its
 *   progress is saved with the existing saveSignupProgress(userId, ...).
 * - Assumption (failure 1, "invite selection"): returning to Invite shows the
 *   restored selection in its field.
 * - Assumption (failure 8): the draft is discarded when /setup opens with a
 *   different, existing account signed in (whether or not the login flow
 *   also discards it).
 * - Assumption (failure 11): "fix the step list once shown" is asserted only
 *   after the person has moved past Welcome.
 * - Assumption (failure 13): a registered account resuming without saved
 *   progress starts at or before residence, never at Welcome.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Failure-list coverage: 1, 8, 9 (page level), 11, 12, 13, 15 (runtime
 * step_index / total_steps).
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen } from '@/test-utils/signup-controls'
import type { ScreenId } from '@/components/Setup/Setup.types'
import InviteStep from '@/components/Setup/Views/Invite'
import { EMPTY_SETUP_COUNTRY_SIGNALS, type SetupCountrySignals } from '@/features/setup/country-signals'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { saveSignupProgress, type SignupProgressAnswers } from '@/features/setup/signup-progress'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { readInviteCode } from '@/utils/invite-stash'
import { resetDeepLinkStateForTests } from '@/utils/deep-link-state'
import SetupLayout from '@/app/(setup)/layout'
import SetupPage from '../page'

type Restrictions = {
    full: Set<string>
    bankingOnly: Set<string>
    cardOnly: Set<string>
    refusedIdIssuers: Set<string>
    bankingNewCustomersOnly: Set<string>
}
type AuthUser = { user: { userId: string; username: string }; accounts: { type: string }[] }
type Env = { user: AuthUser | null; restrictions: Restrictions | null; signals: SetupCountrySignals }

const RESTRICTIONS: Restrictions = {
    full: new Set(['RU']),
    bankingOnly: new Set(['JP']),
    cardOnly: new Set(['IN']),
    refusedIdIssuers: new Set<string>(),
    bankingNewCustomersOnly: new Set<string>(),
}

const mockEnv = (() => {
    const initial: Env = { user: null, restrictions: RESTRICTIONS, signals: EMPTY_SETUP_COUNTRY_SIGNALS }
    let state = initial
    const listeners = new Set<() => void>()
    return {
        get: () => state,
        set: (patch: Partial<Env>) => {
            state = { ...state, ...patch }
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        reset: () => {
            state = initial
        },
    }
})()
const mockUseEnv = () => {
    const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react')
    // jest.mock factories may only reference mock-prefixed names; this runs only inside the mocked hooks below
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSyncExternalStore(mockEnv.subscribe, mockEnv.get)
}
// var: read by modules that call isCapacitor() while they load
var mockNative = true
let mockSearchParams = new URLSearchParams()
const mockRouter = { replace: jest.fn(), push: jest.fn() }
const mockFetchUser = jest.fn(async () => null)
const mockUpdateUser = jest.fn()
const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => mockNative,
    isNativeBridge: () => false,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: mockUseEnv().user,
        isFetchingUser: false,
        fetchUser: mockFetchUser,
        logoutUser: jest.fn(),
        isLoggingOut: false,
    }),
}))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSets: () => mockUseEnv().restrictions,
}))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({ useSetupCountrySignals: () => mockUseEnv().signals }))
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams, useRouter: () => mockRouter }))
jest.mock('@/components/Global/AppShell', () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/features/attention/AttentionBanner', () => ({ AttentionBanner: () => null }))
jest.mock('@/components/Global/SupportDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', IOS: 'ios', ANDROID: 'android' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))
jest.mock('@/hooks/usePullToRefresh', () => ({ usePullToRefresh: jest.fn(), useShouldPullToRefresh: () => false }))
jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({ screenId, showBackButton }: { screenId: string; showBackButton?: boolean }) => (
        <div>
            <span data-testid="page-screen">{screenId}</span>
            {showBackButton && <button>Go back</button>}
        </div>
    ),
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div role="status">Loading</div> }))
jest.mock('@/hooks/useSetupBackHandler', () => ({ useSetupBackHandler: jest.fn() }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({
    BADGE_CAMPAIGN_QUERY_PARAM: 'badge_campaign',
    badgeCampaignsFromSearchParams: () => [],
    getPendingBadgeCampaigns: () => [],
    queuePendingBadgeCampaigns: (campaigns: readonly string[]) => [...campaigns],
}))
jest.mock('@/services/badge-campaigns', () => ({ claimAndSettlePendingBadgeCampaigns: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/services/invites', () => ({
    invitesApi: {
        validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args),
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const DAY = 24 * 60 * 60 * 1000
const WALLET = [{ type: 'peanut-wallet' }]
const NEVER_AGAIN = ['signup', 'invite', 'passkey']

const probe = {} as {
    context: ReturnType<typeof useSetupFlowContext>
    flow: ReturnType<typeof useSetupFlow>
}

function Probe() {
    const context = useSetupFlowContext()
    const flow = useSetupFlow()
    probe.context = context
    probe.flow = flow
    return <>{flow.step?.screenId === 'invite' && onSignupScreen('invite', <InviteStep />)}</>
}

const mount = (urlScreen?: string) =>
    renderWithIntl(
        <NuqsTestingAdapter hasMemory searchParams={urlScreen ? { screen: urlScreen } : {}}>
            <SetupLayout>
                <SetupPage />
                <Probe />
            </SetupLayout>
        </NuqsTestingAdapter>
    )

const pageScreen = () => screen.queryByTestId('page-screen')?.textContent ?? null
const waitForScreen = (id: string) => waitFor(() => expect(pageScreen()).toBe(id), { timeout: 3000 })
const waitForAnyScreen = () => waitFor(() => expect(pageScreen()).not.toBeNull(), { timeout: 3000 })
const stepIds = () => probe.context.steps.map((step) => step.screenId as string)
const goTo = async (id: string) => {
    await act(async () => {
        probe.flow.setScreenId(id as ScreenId)
    })
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 150)))
const recoveryShown = () => screen.queryByRole('button', { name: 'Try again' }) !== null
const storedEntries = () => {
    const entries = new Map<string, string | null>()
    for (const storage of [localStorage, sessionStorage]) {
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index)
            if (key) entries.set(key, storage.getItem(key))
        }
    }
    return entries
}
const overwriteStored = (key: string, value: string) => {
    for (const storage of [localStorage, sessionStorage]) if (storage.getItem(key) !== null) storage.setItem(key, value)
}

/** Presses Next or Back until the cursor stops moving; returns the screens shown on the way. */
const walk = async (direction: 'next' | 'back') => {
    const visited: string[] = []
    for (let i = 0; i < 14; i++) {
        const before = pageScreen()
        await act(async () => {
            if (direction === 'next') await probe.flow.handleNext()
            else probe.flow.handleBack()
        })
        await settle()
        const after = pageScreen()
        if (after === before || after === null) break
        visited.push(after)
    }
    return visited
}

const ANSWERS = {
    residenceCountry: 'AR',
    nationalityCountry: 'BR',
    fundingChannel: 'arsBank',
    paymentChannel: 'qr',
    username: 'kimchi',
    sellScreensCountry: 'AR',
}

const answerEarlierScreens = async () => {
    await act(async () => {
        probe.context.setResidenceCountry('AR')
        probe.context.setNationalityCountry('BR')
        probe.context.setFundingChannel('arsBank')
        probe.context.setPaymentChannel('qr')
        probe.context.setUsername('kimchi')
        probe.context.setSellScreensCountry('AR')
    })
}

/** An anonymous person answers everything up to the passkey screen, inviter included. */
const reachPasskey = async () => {
    await waitForScreen('landing')
    await answerEarlierScreens()
    await goTo('invite')
    await waitForScreen('invite')
    const field = screen.getByRole('textbox', { name: 'Username of the person who invited you' })
    fireEvent.change(field, { target: { value: 'alice' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    })
    await waitForScreen('passkey')
}

/** An anonymous person answers the plan and stops there. */
const reachPaymentPlan = async () => {
    await waitForScreen('landing')
    await answerEarlierScreens()
    await goTo('payment-plan')
    await waitForScreen('payment-plan')
    await settle()
}

const expectRestored = async (screenId: string) => {
    await waitForScreen(screenId)
    expect(probe.context).toEqual(expect.objectContaining(ANSWERS))
}

const expectFresh = async () => {
    await waitForScreen('landing')
    expect(probe.context.residenceCountry).toBe('')
    expect(probe.context.username).toBe('')
    expect(probe.context.fundingChannel).toBeNull()
}

const progressAnswers = (overrides: Partial<SignupProgressAnswers> = {}): SignupProgressAnswers => ({
    residenceCountry: '',
    nationalityCountry: '',
    fundingChannel: null,
    paymentChannel: null,
    notificationChoices: null,
    inviterAccepted: false,
    sellScreensCountry: undefined,
    ...overrides,
})

const clearCookies = () => {
    for (const entry of document.cookie.split(';')) {
        const name = entry.trim().split('=')[0]
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    clearCookies()
    resetDeepLinkStateForTests()
    mockEnv.reset()
    mockNative = true
    mockSearchParams = new URLSearchParams()
    mockUpdateUser.mockResolvedValue({ data: {} })
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
    mockAcceptInvite.mockResolvedValue({ success: true, attributionResolved: true, onboardingResolved: true })
})

describe('the anonymous draft (failure 1)', () => {
    it.each([
        ['an app restart', undefined],
        ['a reload that keeps ?screen=', 'passkey'],
    ])('after %s, restores every answer, the inviter and the screen', async (_label, urlScreen) => {
        const first = mount()
        await reachPasskey()
        first.unmount()

        mount(urlScreen)
        await expectRestored('passkey')
        await act(async () => probe.flow.handleBack())
        await waitForScreen('invite')
        expect(screen.getByRole('textbox', { name: 'Username of the person who invited you' })).toHaveValue('alice')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })

    it.each([
        [29, true],
        [31, false],
    ])('%s days later the draft is kept: %s', async (days, kept) => {
        const first = mount()
        await reachPasskey()
        first.unmount()

        const realNow = Date.now.bind(Date)
        jest.spyOn(Date, 'now').mockImplementation(() => realNow() + days * DAY)
        mount()
        if (kept) {
            await expectRestored('passkey')
            await act(async () => probe.flow.handleBack())
            await waitForScreen('invite')
            expect(screen.getByRole('textbox', { name: 'Username of the person who invited you' })).toHaveValue('alice')
        } else {
            await expectFresh()
        }
    })

    it('ignores a corrupt draft and starts fresh without an error screen', async () => {
        const before = storedEntries()
        const first = mount()
        await reachPaymentPlan()
        first.unmount()
        const written = [...storedEntries()].filter(([key, value]) => before.get(key) !== value).map(([key]) => key)
        expect(written.length).toBeGreaterThan(0)
        for (const key of written) overwriteStored(key, '{not json')

        mount()
        await expectFresh()
        expect(recoveryShown()).toBe(false)
    })

    it('ignores a draft from another version', async () => {
        const first = mount()
        await reachPaymentPlan()
        first.unmount()
        let versioned = 0
        for (const [key, raw] of storedEntries()) {
            try {
                const value = JSON.parse(raw ?? '')
                if (value && typeof value === 'object' && typeof value.version === 'number') {
                    overwriteStored(key, JSON.stringify({ ...value, version: value.version + 1000 }))
                    versioned += 1
                }
            } catch {}
        }
        expect(versioned).toBeGreaterThan(0)

        mount()
        await expectFresh()
    })

    it('works without storage: no crash, the flow moves, nothing comes back', async () => {
        const blocked = () => {
            throw new DOMException('blocked', 'SecurityError')
        }
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
        jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

        const first = mount()
        await reachPaymentPlan()
        expect(recoveryShown()).toBe(false)
        first.unmount()

        mount()
        await waitForScreen('landing')
        expect(recoveryShown()).toBe(false)
    })
})

describe('an existing account signs in over a draft (failure 8)', () => {
    it.each([
        ['a finished account', WALLET],
        ['an account that never finished signup', []],
    ])('discards the draft for %s and never saves it into that account', async (_label, accounts) => {
        const first = mount()
        await reachPaymentPlan()
        first.unmount()
        // the draft is there before the login
        const check = mount()
        await expectRestored('payment-plan')
        check.unmount()

        mockEnv.set({ user: { user: { userId: 'old-1', username: 'olduser' }, accounts } })
        const signedIn = mount()
        await settle()
        await settle()
        expect(probe.context.residenceCountry).not.toBe('AR')
        expect(probe.context.username).not.toBe('kimchi')
        expect(mockUpdateUser.mock.calls.map(([payload]) => payload)).not.toContainEqual(
            expect.objectContaining({ residenceCountry: 'AR' })
        )
        signedIn.unmount()

        mockEnv.set({ user: null })
        mount()
        await expectFresh()
        expect(mockUpdateUser.mock.calls.map(([payload]) => payload)).not.toContainEqual(
            expect.objectContaining({ residenceCountry: 'AR' })
        )
    })
})

describe('invite-link and ?step=signup entry (failure 9)', () => {
    it.each([
        ['an invite link', 'code=alice', EMPTY_SETUP_COUNTRY_SIGNALS, 'advantage-fees', true],
        ['?step=signup', 'step=signup', EMPTY_SETUP_COUNTRY_SIGNALS, 'advantage-fees', false],
        [
            'an invite link where no sell screen is offered',
            'code=alice',
            { ...EMPTY_SETUP_COUNTRY_SIGNALS, vercelIpCountry: 'RU' },
            'residence',
            true,
        ],
    ])('%s starts at the first screen after Welcome', async (_label, query, signals, expected, invited) => {
        mockSearchParams = new URLSearchParams(query)
        mockEnv.set({ signals })
        mount()
        await waitForScreen(expected)
        expect(pageScreen()).not.toBe('signup')
        if (invited) {
            expect(readInviteCode()).toBe('alice')
            expect(stepIds()).not.toContain('invite')
        }
        expect(stepIds()).toContain('passkey')
    })

    it('keeps the web landing gate: a web invite link while web signup is closed lands on Welcome', async () => {
        mockNative = false
        mockSearchParams = new URLSearchParams('code=alice')
        mount()
        await waitForScreen('landing')
        await settle()
        expect(pageScreen()).toBe('landing')
    })
})

describe('a late country or config answer (failure 11)', () => {
    it.each<[string, string, Partial<Env>, Partial<Env>]>([
        [
            'advantage-card',
            'a suggestion where only accounts are offered',
            {},
            {
                signals: { ...EMPTY_SETUP_COUNTRY_SIGNALS, vercelIpCountry: 'IN' },
            },
        ],
        [
            'advantage-fees',
            'a suggestion where only the card is offered',
            {},
            {
                signals: { ...EMPTY_SETUP_COUNTRY_SIGNALS, vercelIpCountry: 'JP' },
            },
        ],
        [
            'advantage-fees',
            'a suggestion where nothing is offered',
            {},
            {
                signals: { ...EMPTY_SETUP_COUNTRY_SIGNALS, vercelIpCountry: 'RU' },
            },
        ],
        [
            'advantage-card',
            'restriction lists arriving with such a suggestion',
            { restrictions: null },
            {
                restrictions: RESTRICTIONS,
                signals: { ...EMPTY_SETUP_COUNTRY_SIGNALS, vercelIpCountry: 'RU' },
            },
        ],
    ])('keeps the person on %s after %s, with the list as shown', async (current, _label, initial, late) => {
        mockEnv.set(initial)
        mount()
        await waitForScreen('landing')
        await goTo(current)
        await waitForScreen(current)
        const shown = stepIds()

        await act(async () => mockEnv.set(late))
        await settle()

        expect(pageScreen()).toBe(current)
        expect(probe.flow.step?.screenId).toBe(current)
        expect(stepIds()).toEqual(shown)
        expect(recoveryShown()).toBe(false)
    })
})

describe('a registered account from the old order (failures 12, 13)', () => {
    const registered = () => mockEnv.set({ user: { user: { userId: 'u-1', username: 'kimchi' }, accounts: [] } })

    it.each([
        'advantage-fees',
        'advantage-card',
        'residence',
        'payment-plan',
        'notification-email',
        'notification-permission',
        'advantage-control',
    ])('saved at %s finishes from there and never sees Claim, Invite or Passkey', async (saved) => {
        registered()
        saveSignupProgress('u-1', {
            screenId: saved as ScreenId,
            answers: progressAnswers({ residenceCountry: 'AR', fundingChannel: 'arsBank', paymentChannel: 'qr' }),
        })
        mount()
        await waitForScreen(saved)
        const forward = await walk('next')
        const backward = await walk('back')
        for (const id of NEVER_AGAIN) {
            expect(forward).not.toContain(id)
            expect(backward).not.toContain(id)
        }
    })

    it.each([
        ['no saved progress', null],
        ['progress saved on the old Invite screen', 'invite'],
    ])('with %s and no residence or plan, asks both before Email', async (_label, saved) => {
        registered()
        if (saved) saveSignupProgress('u-1', { screenId: saved as ScreenId, answers: progressAnswers() })
        mount()
        await waitForAnyScreen()
        await settle()
        const start = pageScreen() as string
        expect(['landing', ...NEVER_AGAIN]).not.toContain(start)

        const visited = [start, ...(await walk('next'))]
        for (const id of NEVER_AGAIN) expect(visited).not.toContain(id)
        expect(visited).toContain('residence')
        expect(visited).toContain('payment-plan')
        expect(visited.indexOf('residence')).toBeLessThan(visited.indexOf('notification-email'))
        expect(visited.indexOf('payment-plan')).toBeLessThan(visited.indexOf('notification-email'))
    })
})

describe('step analytics follow the runtime list (failure 15)', () => {
    it.each([
        ['a plain signup', '', 8, 11],
        ['an invite link (Invite hidden)', 'code=alice', 7, 10],
    ])('views the passkey screen in %s (query %p) as step %s of %s', async (_label, query, index, total) => {
        mockSearchParams = new URLSearchParams(query)
        mount()
        await waitForAnyScreen()
        await settle()
        await goTo('passkey')
        await waitForScreen('passkey')
        expect(posthog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED,
            expect.objectContaining({ screen_id: 'passkey', step_index: index, total_steps: total, flow_version: 2 })
        )
    })
})
