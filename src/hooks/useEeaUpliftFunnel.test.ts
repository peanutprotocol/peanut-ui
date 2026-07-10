import { act, renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import { useEeaUpliftFunnel } from './useEeaUpliftFunnel'
import type { UpliftStartTrigger } from '@/utils/eea-uplift.utils'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
const capture = posthog.capture as jest.Mock

// future-dated advisory (upcoming) trigger
const advisoryTrigger: UpliftStartTrigger = {
    effectiveDate: '2026-12-31',
    actionKey: 'sumsub:eea_uplift',
    requirementKey: 'has_foreign_tax_registration',
    source: 'advisory',
}

// post-cliff blocking trigger — no effective date, reason code as the key
const blockingTrigger: UpliftStartTrigger = {
    requirementKey: 'eea_uplift',
    source: 'blocking',
}

beforeEach(() => capture.mockClear())

describe('useEeaUpliftFunnel', () => {
    test('trackStarted fires eea_uplift_started with channel + trigger props (advisory = not urgent)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisoryTrigger))

        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.EEA_UPLIFT_STARTED, {
            channel: 'deposit',
            requirement_key: 'has_foreign_tax_registration',
            action_key: 'sumsub:eea_uplift',
            effective_date: '2026-12-31',
            source: 'advisory',
            urgent: false,
        })
    })

    test('blocking trigger is flagged urgent', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(blockingTrigger))

        expect(capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.EEA_UPLIFT_STARTED,
            expect.objectContaining({ source: 'blocking', urgent: true, requirement_key: 'eea_uplift' })
        )
    })

    test('trackStarted is idempotent per armed attempt (repeat clicks do not re-emit)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(blockingTrigger))
        act(() => result.current.trackStarted(blockingTrigger))
        expect(capture).toHaveBeenCalledTimes(1)

        // a genuinely different requirement re-arms and fires again
        act(() => result.current.trackStarted(advisoryTrigger))
        expect(capture).toHaveBeenCalledTimes(2)
    })

    test('after reset, the same trigger fires again (a new attempt)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(blockingTrigger))
        act(() => result.current.reset())
        act(() => result.current.trackStarted(blockingTrigger))
        expect(capture).toHaveBeenCalledTimes(2)
    })

    test('trackCompleted fires eea_uplift_completed only after a start, echoing the trigger', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('withdraw'))
        act(() => result.current.trackStarted(advisoryTrigger))
        capture.mockClear()

        act(() => result.current.trackCompleted())
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.EEA_UPLIFT_COMPLETED, {
            channel: 'withdraw',
            requirement_key: 'has_foreign_tax_registration',
            action_key: 'sumsub:eea_uplift',
            effective_date: '2026-12-31',
            source: 'advisory',
            urgent: false,
        })
    })

    test('trackCompleted is a no-op when no start was recorded (generic KYC success)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackCompleted())
        expect(capture).not.toHaveBeenCalled()
    })

    test('trackCompleted only fires once per start (ref cleared)', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisoryTrigger))
        capture.mockClear()

        act(() => result.current.trackCompleted())
        act(() => result.current.trackCompleted())
        expect(capture).toHaveBeenCalledTimes(1)
    })

    test('reset clears a pending start so a later success cannot mis-fire completed', () => {
        const { result } = renderHook(() => useEeaUpliftFunnel('deposit'))
        act(() => result.current.trackStarted(advisoryTrigger))
        capture.mockClear()

        // user abandoned the flow → reset, then an unrelated KYC success fires
        act(() => result.current.reset())
        act(() => result.current.trackCompleted())
        expect(capture).not.toHaveBeenCalled()
    })
})
