import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { SETUP_DEFAULT_SCREEN, useSetupFlow } from '@/hooks/useSetupFlow'
import { SetupFlowProvider, useSetupFlowContext } from '../SetupFlowContext'
import { setupSteps } from '@/components/Setup/Setup.consts'

// native detection is mocked so the history-mode contract below can flip it
let mockIsNativeBridge = false
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: () => mockIsNativeBridge,
}))

// The setup cursor is a named screen id in the URL driven by the shared
// stepper (TASK-21460) — these pin the contracts that replaced the redux
// numeric index: no silent clamps (TASK-21404), named ids never indexes,
// and the point of no return after a no-back step renders.

const STEPS = setupSteps.filter((s) =>
    ['landing', 'welcome', 'signup', 'residence', 'passkey-permission', 'sign-test-transaction'].includes(s.screenId)
)

// What the (setup) layout hands over during the pwa-sunset window: the three
// install/unsupported screens the master list STARTS with are filtered out.
const SUNSET_STEPS = setupSteps.filter(
    (s) => !['pwa-install', 'android-initial-pwa-install', 'unsupported-browser'].includes(s.screenId)
)

const wrapperFor = (searchParams: Record<string, string>) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <NuqsTestingAdapter searchParams={searchParams}>
                <SetupFlowProvider>{children}</SetupFlowProvider>
            </NuqsTestingAdapter>
        )
    }

const renderFlow = (searchParams: Record<string, string> = {}) =>
    renderHook(
        () => {
            const context = useSetupFlowContext()
            const flow = useSetupFlow()
            return { context, flow }
        },
        { wrapper: wrapperFor(searchParams) }
    )

const seedSteps = async (
    result: { current: { context: { setSteps: (s: typeof setupSteps) => void } } },
    steps: typeof setupSteps = STEPS
) => {
    await act(async () => {
        result.current.context.setSteps(steps)
    })
}

describe('useSetupFlow (URL stepper)', () => {
    it('reads a named screen id from the URL — never an index', async () => {
        const { result } = renderFlow({ screen: 'signup' })
        await seedSteps(result)
        expect(result.current.flow.step?.screenId).toBe('signup')
        expect(result.current.flow.currentIndex).toBe(2)
    })

    it('an unknown screen id falls back to the first step instead of a dead screen', async () => {
        const { result } = renderFlow({ screen: '4' })
        await seedSteps(result)
        expect(result.current.flow.step?.screenId).toBe('landing')
    })

    it('handleNext walks the filtered list and reports the end explicitly — no clamp loop (TASK-21404)', async () => {
        const { result } = renderFlow({ screen: 'passkey-permission' })
        await seedSteps(result)
        await act(async () => {
            await result.current.flow.handleNext()
        })
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
        expect(result.current.flow.isLastStep).toBe(true)
        // at the end, next is a no-op rather than a silent re-render of the same index
        await act(async () => {
            await result.current.flow.handleNext()
        })
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
    })

    it('handleNext(screenId) jumps to a named screen', async () => {
        const { result } = renderFlow({ screen: 'landing' })
        await seedSteps(result)
        await act(async () => {
            await result.current.flow.handleNext(undefined, 'residence')
        })
        expect(result.current.flow.step?.screenId).toBe('residence')
        expect(result.current.context.direction).toBe(1)
    })

    it('a failing validation callback stays on the step', async () => {
        const { result } = renderFlow({ screen: 'signup' })
        await seedSteps(result)
        await act(async () => {
            await result.current.flow.handleNext(async () => false)
        })
        expect(result.current.flow.step?.screenId).toBe('signup')
    })

    it('handleBack walks backward and sets the back direction', async () => {
        const { result } = renderFlow({ screen: 'residence' })
        await seedSteps(result)
        await act(async () => {
            result.current.flow.handleBack()
        })
        expect(result.current.flow.step?.screenId).toBe('signup')
        expect(result.current.context.direction).toBe(-1)
    })

    it('point of no return: once the page arms the lock for a VISIBLE no-back step, earlier screens bounce back', async () => {
        const { result } = renderFlow({ screen: 'sign-test-transaction' })
        await seedSteps(result)
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
        // the page arms the lock only when stepRendered confirms visibility
        await act(async () => {
            result.current.context.setNoBackLockScreenId('sign-test-transaction')
        })
        // a backward URL move (browser back / hand edit) may not re-enter the forms
        await act(async () => {
            await result.current.flow.setScreenId('signup')
        })
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
    })

    it('a STALE terminal URL never locks: with no rendered lock, entry resolution can replace it (Chip round 2)', async () => {
        // fresh logged-out session lands on /setup?screen=sign-test-transaction
        // (a copied/reloaded stale URL) — the page is still on its loading
        // screen, so no lock is armed and the entry resolver moves freely
        const { result } = renderFlow({ screen: 'sign-test-transaction' })
        await seedSteps(result)
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
        await act(async () => {
            await result.current.flow.setScreenId('signup')
        })
        expect(result.current.flow.step?.screenId).toBe('signup')
    })

    /*
     * The cursor a clean /setup URL means must be a screen the runtime filter
     * keeps. While it was steps[0] it moved with the list — the master
     * fallback starts at 'unsupported-browser', the sunset list at 'landing' —
     * so a clean URL could name a screen absent from the list in force, which
     * is no step at all and put the page on its recovery screen instead of the
     * flow (PEANUT-UI-T3A: back into /setup after signup).
     */
    it('the default cursor survives every runtime filter the layout applies', () => {
        for (const list of [setupSteps, STEPS, SUNSET_STEPS]) {
            expect(list.some((s) => s.screenId === SETUP_DEFAULT_SCREEN)).toBe(true)
        }
    })

    it('a clean URL resolves to a step the sunset-filtered list actually has', async () => {
        const { result } = renderFlow()
        await seedSteps(result, SUNSET_STEPS)
        expect(result.current.flow.step?.screenId).toBe(SETUP_DEFAULT_SCREEN)
        expect(result.current.flow.currentIndex).toBeGreaterThanOrEqual(0)
    })

    it('a filtered-out screen in the URL resolves to the default, never to no step', async () => {
        const { result } = renderFlow({ screen: 'unsupported-browser' })
        await seedSteps(result, SUNSET_STEPS)
        expect(result.current.flow.step).toBeDefined()
        expect(result.current.flow.step?.screenId).toBe(SETUP_DEFAULT_SCREEN)
    })

    it('resetSetupFlow disarms the lock (start-fresh on the existing-session interstitial)', async () => {
        const { result } = renderFlow({ screen: 'sign-test-transaction' })
        await seedSteps(result)
        await act(async () => {
            result.current.context.setNoBackLockScreenId('sign-test-transaction')
        })
        await act(async () => {
            result.current.context.resetSetupFlow()
        })
        await act(async () => {
            await result.current.flow.setScreenId('signup')
        })
        expect(result.current.flow.step?.screenId).toBe('signup')
    })
})

// Native hardware Back is consumed by useSetupBackHandler (it calls handleBack
// directly), so setup transitions must NOT mint WebView history entries there:
// pushed entries are never consumed during the flow, and Back after completing
// setup would pop through stale /setup screens back into onboarding — the
// contract the deleted useSetupStepUrlSync mirror kept via replaceState (Chip
// review, PR #2949). The browser keeps push so web Back walks the steps.
describe('useSetupFlow — history mode per platform', () => {
    // rateLimitFactor 0: handleNext fire-and-forgets the URL write (void
    // goTo), so without it the assertion can outrun nuqs's throttle queue on
    // a slow runner (this exact pair passed locally and failed in CI)
    const renderWithUrlSpy = (onUrlUpdate: OnUrlUpdateFunction) =>
        renderHook(
            () => {
                const context = useSetupFlowContext()
                const flow = useSetupFlow()
                return { context, flow }
            },
            {
                wrapper: ({ children }: { children: ReactNode }) => (
                    <NuqsTestingAdapter
                        searchParams={{ screen: 'signup' }}
                        onUrlUpdate={onUrlUpdate}
                        rateLimitFactor={0}
                    >
                        <SetupFlowProvider>{children}</SetupFlowProvider>
                    </NuqsTestingAdapter>
                ),
            }
        )

    afterEach(() => {
        mockIsNativeBridge = false
    })

    it('web: transitions push, so browser Back walks the steps', async () => {
        mockIsNativeBridge = false
        const onUrlUpdate = jest.fn()
        const { result } = renderWithUrlSpy(onUrlUpdate)
        await seedSteps(result)
        await act(async () => {
            await result.current.flow.handleNext()
            // one macrotask: let the (fire-and-forget) URL write flush
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const update = onUrlUpdate.mock.calls.at(-1)?.[0]
        expect(update?.searchParams.get('screen')).toBe('residence')
        expect(update?.options.history).toBe('push')
    })

    it('native: transitions replace — hardware Back is handled in-app, entries must not pile up', async () => {
        mockIsNativeBridge = true
        const onUrlUpdate = jest.fn()
        const { result } = renderWithUrlSpy(onUrlUpdate)
        await seedSteps(result)
        await act(async () => {
            await result.current.flow.handleNext()
            // one macrotask: let the (fire-and-forget) URL write flush
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const update = onUrlUpdate.mock.calls.at(-1)?.[0]
        expect(update?.searchParams.get('screen')).toBe('residence')
        expect(update?.options.history).toBe('replace')
    })
})
