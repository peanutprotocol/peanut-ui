import { act, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { useFlowStepper } from '../useFlowStepper'
import type { FlowStepperOptions } from '../useFlowStepper.types'

const STEPS = ['method', 'amount', 'review', 'success'] as const
type Step = (typeof STEPS)[number]

const wrapperFor = (searchParams: Record<string, string>, onUrlUpdate?: OnUrlUpdateFunction) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                {children}
            </NuqsTestingAdapter>
        )
    }

const render = (
    searchParams: Record<string, string>,
    options: Partial<FlowStepperOptions<Step>> = {},
    onUrlUpdate?: OnUrlUpdateFunction
) =>
    renderHook(() => useFlowStepper<Step>({ steps: STEPS, ...options }), {
        wrapper: wrapperFor(searchParams, onUrlUpdate),
    })

describe('useFlowStepper', () => {
    it('starts on the first step when the URL has no step param', () => {
        const { result } = render({})
        expect(result.current.step).toBe('method')
        expect(result.current.isFirst).toBe(true)
    })

    it('reads a named step id from the URL', () => {
        const { result } = render({ step: 'review' })
        expect(result.current.step).toBe('review')
        expect(result.current.isFirst).toBe(false)
    })

    it('falls back to the default step on an unknown step id (never an index)', () => {
        const { result } = render({ step: '2' })
        expect(result.current.step).toBe('method')
    })

    it('goTo writes the step id into the URL', async () => {
        const onUrlUpdate = jest.fn()
        const { result } = render({}, {}, onUrlUpdate)
        await act(async () => {
            await result.current.goTo('amount')
        })
        expect(result.current.step).toBe('amount')
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('step')).toBe('amount')
    })

    it('goTo(default step) clears the param instead of writing it', async () => {
        const onUrlUpdate = jest.fn()
        const { result } = render({ step: 'amount' }, {}, onUrlUpdate)
        await act(async () => {
            await result.current.goTo('method')
        })
        expect(result.current.step).toBe('method')
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('step')).toBeNull()
    })

    it('back walks the step list in order', async () => {
        const { result } = render({ step: 'review' })
        await act(async () => {
            await result.current.back()
        })
        expect(result.current.step).toBe('amount')
        await act(async () => {
            await result.current.back()
        })
        expect(result.current.step).toBe('method')
    })

    it('back on the first step calls onExit', async () => {
        const onExit = jest.fn()
        const { result } = render({}, { onExit })
        await act(async () => {
            await result.current.back()
        })
        expect(onExit).toHaveBeenCalledTimes(1)
        expect(result.current.step).toBe('method')
    })

    it('backMap overrides the linear back path', async () => {
        const { result } = render({ step: 'review' }, { backMap: { review: 'method' } })
        await act(async () => {
            await result.current.back()
        })
        expect(result.current.step).toBe('method')
    })

    it('a failing guard resolves to its fallback without rendering the dead step', () => {
        const { result } = render({ step: 'review' }, { guards: { review: { ok: false, fallback: 'amount' } } })
        expect(result.current.step).toBe('amount')
    })

    it('a failing guard with no fallback resolves to the default step', () => {
        const { result } = render({ step: 'review' }, { guards: { review: { ok: false } } })
        expect(result.current.step).toBe('method')
    })

    it('a passing guard leaves the step alone', () => {
        const { result } = render({ step: 'review' }, { guards: { review: { ok: true, fallback: 'amount' } } })
        expect(result.current.step).toBe('review')
    })

    it('the guard redirect rewrites the URL to the resolved step', async () => {
        const onUrlUpdate = jest.fn()
        const { result } = render(
            { step: 'success' },
            { guards: { success: { ok: false, fallback: 'review' } } },
            onUrlUpdate
        )
        expect(result.current.step).toBe('review')
        await act(async () => {})
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('step')).toBe('review')
    })

    it('reset clears the step param', async () => {
        const onUrlUpdate = jest.fn()
        const { result } = render({ step: 'review' }, {}, onUrlUpdate)
        await act(async () => {
            await result.current.reset()
        })
        expect(result.current.step).toBe('method')
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('step')).toBeNull()
    })

    it('supports a custom URL key', () => {
        const { result } = render({ screen: 'amount' }, { urlKey: 'screen' })
        expect(result.current.step).toBe('amount')
    })
})
