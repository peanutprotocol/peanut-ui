jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance tests for the signup reorder (spec: signup-reorder-spec.md).
 * Written before the implementation; they describe the target behaviour.
 *
 * ── Guessed names (align the implementation or adjust here) ──────────────
 * - New screen id: 'passkey' (ScreenId union + setupSteps entry in Setup.consts).
 *   Cast as ScreenId below so this file compiles before the union has it.
 * - postRegistrationScreen(screenIds) (useSetupFlow.ts) keeps its name and
 *   signature and now returns the first screen after 'passkey'.
 * - SIGNUP_FLOW_VERSION / signupAnalyticsContext (signup-analytics.ts) keep
 *   their names.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Failure-list coverage: 7 (Back before/after the passkey), 15 (flow version,
 * passkey screen_id, runtime step_index/total_steps), plus the step order and
 * filtering the spec fixes.
 */

import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import type { ISetupStep, ScreenId } from '@/components/Setup/Setup.types'
import { postRegistrationScreen, useSetupFlow } from '@/hooks/useSetupFlow'
import { SetupFlowProvider, useSetupFlowContext } from '../SetupFlowContext'
import { filterSetupStepsForCountry, filterSetupStepsForInvite } from '../filterSetupSteps'
import { SIGNUP_FLOW_VERSION, signupAnalyticsContext } from '../signup-analytics'
import { useSetupStepAnalytics } from '../useSetupStepAnalytics'

let mockIsNativeBridge = false
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: () => mockIsNativeBridge,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const PASSKEY = 'passkey' as ScreenId

const NEW_ORDER = [
    'landing',
    'advantage-fees',
    'advantage-card',
    'residence',
    'payment-plan',
    'signup',
    'invite',
    'passkey',
    'notification-email',
    'notification-permission',
    'advantage-control',
]

const restrictions = {
    full: new Set(['RU']),
    bankingOnly: new Set(['JP']),
    cardOnly: new Set(['IN']),
    refusedIdIssuers: new Set<string>(),
    bankingNewCustomersOnly: new Set<string>(),
}

const runtimeList = (country: string | null, hasInvite: boolean) =>
    filterSetupStepsForInvite(filterSetupStepsForCountry(setupSteps, restrictions, country), hasInvite)
const ids = (steps: ISetupStep[]) => steps.map((step) => step.screenId as string)

const renderFlow = (screen: string) =>
    renderHook(
        () => {
            const context = useSetupFlowContext()
            const flow = useSetupFlow()
            return { context, flow }
        },
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <NuqsTestingAdapter hasMemory searchParams={{ screen }}>
                    <SetupFlowProvider masterScreenIds={setupScreenIds}>{children}</SetupFlowProvider>
                </NuqsTestingAdapter>
            ),
        }
    )

type Flow = ReturnType<typeof renderFlow>['result']

const seed = async (result: Flow, steps: ISetupStep[]) => {
    await act(async () => {
        result.current.context.setSteps(steps)
    })
}

/** Presses Back until the cursor stops moving; returns every screen reached on the way. */
const walkBack = async (result: Flow) => {
    const visited: string[] = []
    for (let i = 0; i < NEW_ORDER.length + 2; i++) {
        const before = result.current.flow.step?.screenId
        await act(async () => result.current.flow.handleBack())
        const after = result.current.flow.step?.screenId
        if (after === before) break
        visited.push(after as string)
    }
    return visited
}

beforeEach(() => {
    jest.clearAllMocks()
    mockIsNativeBridge = false
})

describe('step order', () => {
    it('runs Welcome, sell screens, residence, plan, Claim username, Invite, Passkey, then email, notifications and control', () => {
        expect(setupScreenIds).toEqual(NEW_ORDER)
    })

    it('registers a passkey screen with a Back button between Invite and the email step', () => {
        const passkey = setupSteps.find((step) => step.screenId === PASSKEY)
        expect(passkey).toBeDefined()
        expect(passkey?.component).toEqual(expect.anything())
        expect(passkey?.showBackButton).toBe(true)
    })

    it.each([
        ['PT', ['advantage-fees', 'advantage-card']],
        ['IN', ['advantage-fees']],
        ['JP', ['advantage-card']],
        ['RU', []],
        [null, ['advantage-fees', 'advantage-card']],
    ])('keeps the country filter for %p: offered sell screens sit between Welcome and residence', (country, sell) => {
        const list = ids(runtimeList(country, false))
        expect(list).toEqual(['landing', ...sell, ...NEW_ORDER.slice(NEW_ORDER.indexOf('residence'))])
    })

    it('hides only the Invite screen when the signup carries an invite', () => {
        const withInvite = ids(runtimeList('PT', true))
        expect(withInvite).not.toContain('invite')
        expect(withInvite).toEqual(NEW_ORDER.filter((id) => id !== 'invite'))
        expect(withInvite).toContain('passkey')
        expect(withInvite).toContain('signup')
    })
})

// Behaviour of the prelude itself stays pinned by paperwork-verification/__tests__/VerifySetupPrelude.test.tsx.
describe('verify prelude (failure 17, regression guard)', () => {
    it('still builds Residence then Payment plan from the registry, with no signup screen in between', () => {
        const prelude = setupSteps
            .filter((step) => ['residence', 'payment-plan'].includes(step.screenId))
            .map((step) => step.screenId)
        expect(prelude).toEqual(['residence', 'payment-plan'])
        expect(NEW_ORDER.slice(NEW_ORDER.indexOf('residence'), NEW_ORDER.indexOf('payment-plan') + 1)).toEqual([
            'residence',
            'payment-plan',
        ])
    })
})

describe('post-registration boundary', () => {
    it.each([
        ['PT', false],
        ['PT', true],
        ['IN', false],
        ['JP', true],
        ['RU', false],
        ['RU', true],
        [null, false],
    ])('is the email step whatever the filters keep (country %p, invite %p)', (country, hasInvite) => {
        expect(postRegistrationScreen(runtimeList(country, hasInvite).map((step) => step.screenId))).toBe(
            'notification-email'
        )
    })
})

describe('Back before and after the passkey succeeds (failure 7)', () => {
    it.each([
        [false, ['invite', 'signup', 'payment-plan', 'residence', 'advantage-card', 'advantage-fees', 'landing']],
        [true, ['signup', 'payment-plan', 'residence', 'advantage-card', 'advantage-fees', 'landing']],
    ])(
        'walks back from the passkey screen through every earlier screen (invite stashed: %p)',
        async (hasInvite, expected) => {
            const { result } = renderFlow('passkey')
            await seed(result, runtimeList('PT', hasInvite))
            expect(result.current.flow.step?.screenId).toBe(PASSKEY)
            expect(await walkBack(result)).toEqual(expected)
        }
    )

    it('once the lock is armed at the post-registration boundary, Back stops at the email step', async () => {
        const { result } = renderFlow('advantage-control')
        const steps = runtimeList('PT', false)
        await seed(result, steps)
        await act(async () => {
            result.current.context.setNoBackLockScreenId(postRegistrationScreen(steps.map((step) => step.screenId)))
        })
        expect(await walkBack(result)).toEqual(['notification-permission', 'notification-email'])
        expect(result.current.flow.step?.screenId).toBe('notification-email')
    })

    it.each(['passkey', 'invite', 'signup', 'payment-plan', 'residence', 'advantage-fees', 'landing'])(
        'once locked, a URL move or history pop to %s lands back on the email step',
        async (target) => {
            const { result } = renderFlow('notification-email')
            const steps = runtimeList('PT', false)
            await seed(result, steps)
            await act(async () => {
                result.current.context.setNoBackLockScreenId(postRegistrationScreen(steps.map((step) => step.screenId)))
            })
            await act(async () => {
                result.current.flow.setScreenId(target as ScreenId)
            })
            expect(result.current.flow.step?.screenId).toBe('notification-email')
        }
    )

    it('Next from the passkey screen is the email step, not a sell screen or residence', async () => {
        const { result } = renderFlow('invite')
        await seed(result, runtimeList('PT', false))
        await act(async () => {
            await result.current.flow.handleNext()
        })
        expect(result.current.flow.step?.screenId).toBe(PASSKEY)
        await act(async () => {
            await result.current.flow.handleNext()
        })
        expect(result.current.flow.step?.screenId).toBe('notification-email')
    })
})

describe('analytics (failure 15)', () => {
    it.each(setupSteps.map((step) => [step.screenId, step] as const))(
        'views %s once per visit even after rerender',
        (_id, step) => {
            const { rerender } = renderHook(() =>
                useSetupStepAnalytics({ enabled: true, step, steps: setupSteps, signupEntryFlow: 'default' })
            )
            const views = () =>
                (posthog.capture as jest.Mock).mock.calls.filter(
                    ([event]) => event === ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED
                )
            rerender()
            expect(views()).toEqual([
                [
                    ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED,
                    expect.objectContaining({ screen_id: step.screenId, step_index: setupSteps.indexOf(step) + 1 }),
                ],
            ])
        }
    )
    it('reports flow version 2', () => {
        expect(SIGNUP_FLOW_VERSION).toBe(2)
        expect(signupAnalyticsContext('default')).toEqual({ flow_version: 2, signup_entry_flow: 'default' })
    })

    it.each([
        ['PT', false],
        ['PT', true],
        ['RU', false],
        ['IN', true],
    ])(
        'views the passkey screen as screen_id passkey at its place in the runtime list (country %p, invite %p)',
        (country, hasInvite) => {
            const steps = runtimeList(country, hasInvite)
            const passkey = steps.find((step) => step.screenId === PASSKEY)
            expect(passkey).toBeDefined()
            renderHook(() => useSetupStepAnalytics({ enabled: true, step: passkey, steps, signupEntryFlow: 'default' }))
            const expectedList = NEW_ORDER.filter(
                (id) =>
                    (hasInvite ? id !== 'invite' : true) &&
                    ids(filterSetupStepsForCountry(setupSteps, restrictions, country)).includes(id)
            )
            expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
                screen_id: 'passkey',
                step_index: expectedList.indexOf('passkey') + 1,
                total_steps: expectedList.length,
                nav_type: 'initial',
                flow_version: 2,
                signup_entry_flow: 'default',
            })
        }
    )
})
