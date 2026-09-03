import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { useSetupFlow } from '@/hooks/useSetupFlow'
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

const seedSteps = async (result: { current: { context: { setSteps: (s: typeof STEPS) => void } } }) => {
    await act(async () => {
        result.current.context.setSteps(STEPS)
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

    it('point of no return: after a no-back step renders, earlier screens bounce back (history pop tampering)', async () => {
        const { result, rerender } = renderFlow({ screen: 'sign-test-transaction' })
        await seedSteps(result)
        // the no-back step has rendered — its lock is derived from the render
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
        rerender()
        // a backward URL move (browser back / hand edit) may not re-enter the forms
        await act(async () => {
            await result.current.flow.setScreenId('signup')
        })
        expect(result.current.flow.step?.screenId).toBe('sign-test-transaction')
    })
})

// Native hardware Back is consumed by useSetupBackHandler (it calls handleBack
// directly), so setup transitions must NOT mint WebView history entries there:
// pushed entries are never consumed during the flow, and Back after completing
// setup would pop through stale /setup screens back into onboarding — the
// contract the deleted useSetupStepUrlSync mirror kept via replaceState (Chip
// review, PR #2949). The browser keeps push so web Back walks the steps.
describe('useSetupFlow — history mode per platform', () => {
    const renderWithUrlSpy = (onUrlUpdate: OnUrlUpdateFunction) =>
        renderHook(
            () => {
                const context = useSetupFlowContext()
                const flow = useSetupFlow()
                return { context, flow }
            },
            {
                wrapper: ({ children }: { children: ReactNode }) => (
                    <NuqsTestingAdapter searchParams={{ screen: 'signup' }} onUrlUpdate={onUrlUpdate}>
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
        })
        const update = onUrlUpdate.mock.calls.at(-1)?.[0]
        expect(update?.searchParams.get('screen')).toBe('residence')
        expect(update?.options.history).toBe('replace')
    })
})
