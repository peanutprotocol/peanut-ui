import { act, renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import { useEeaUpliftFunnel } from './useEeaUpliftFunnel'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { GateAdvisory } from '@/utils/capability-gate'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
const capture = posthog.capture as jest.Mock

const advisory: GateAdvisory = {
    effectiveDate: '2026-06-29',
    actionKey: 'sumsub:eea_uplift',
    requirementKey: 'sof_individual_primary_purpose',
}

beforeEach(() => capture.mockClear())

describe('useEeaUpliftFunnel', () => {
    test('trackStarted fires eea_uplift_started with channel + advisory props', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisory))

        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.EEA_UPLIFT_STARTED, {
            channel: 'deposit',
            requirement_key: 'sof_individual_primary_purpose',
            action_key: 'sumsub:eea_uplift',
            effective_date: '2026-06-29',
        })
    })

    test('trackCompleted fires eea_uplift_completed only after a start', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('withdraw'))
        act(() => result.current.trackStarted(advisory))
        capture.mockClear()

        act(() => result.current.trackCompleted())
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.EEA_UPLIFT_COMPLETED, {
            channel: 'withdraw',
            requirement_key: 'sof_individual_primary_purpose',
            action_key: 'sumsub:eea_uplift',
            effective_date: '2026-06-29',
        })
    })

    test('trackCompleted is a no-op when no start was recorded (generic KYC success)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackCompleted())
        expect(capture).not.toHaveBeenCalled()
    })

    test('trackCompleted only fires once per start (ref cleared)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisory))
        capture.mockClear()

        act(() => result.current.trackCompleted())
        act(() => result.current.trackCompleted())
        expect(capture).toHaveBeenCalledTimes(1)
    })

    test('reset clears a pending start so a later success cannot mis-fire completed', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisory))
        capture.mockClear()

        // user abandoned the flow → reset, then an unrelated KYC success fires
        act(() => result.current.reset())
        act(() => result.current.trackCompleted())
        expect(capture).not.toHaveBeenCalled()
    })
})
