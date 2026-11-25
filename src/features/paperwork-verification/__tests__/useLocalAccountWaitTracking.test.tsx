/** TASK-25059: the account progress screen reports how long the user waited and how the wait ended. */
import { renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import type { useKycFeatureActivation } from '../useKycFeatureActivation'
import { useLocalAccountWaitTracking } from '../useLocalAccountWaitTracking'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

type Activation = ReturnType<typeof useKycFeatureActivation>
const activation = (overrides: Partial<Activation>): Activation =>
    ({
        allowed: false,
        userReady: true,
        result: null,
        reverification: null,
        selectedStatus: undefined,
        arsProvisioning: false,
        isLoading: false,
        settling: false,
        activate: jest.fn(),
        ...overrides,
    }) as Activation
const pending = { kind: 'report', report: { state: 'pending' } } as Activation['result']
const calls = () => jest.mocked(posthog.capture).mock.calls

beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(posthog.capture).mockClear()
})
afterEach(() => jest.useRealTimers())

function track(start: Partial<Activation>) {
    return renderHook(({ state }) => useLocalAccountWaitTracking(state, 'ARS'), {
        initialProps: { state: activation(start) },
    })
}

it('a wait that ends with the account on reports opened and its length', () => {
    const { rerender } = track({ settling: true, isLoading: true })
    expect(calls()).toEqual([['local_account_wait_started', { currency: 'ARS', found_pending: false }]])
    jest.advanceTimersByTime(26_000)
    rerender({ state: activation({ allowed: true }) })
    expect(calls()[1]).toEqual(['local_account_wait_ended', { currency: 'ARS', outcome: 'opened', wait_ms: 26_000 }])
})

it('an account still pending at the end of the wait reports timed_out', () => {
    const { rerender } = track({ settling: true, result: pending })
    jest.advanceTimersByTime(120_000)
    rerender({ state: activation({ result: pending }) })
    expect(calls()[1]).toEqual([
        'local_account_wait_ended',
        { currency: 'ARS', outcome: 'timed_out', wait_ms: 120_000 },
    ])
})

it('a failed start reports failed', () => {
    const { rerender } = track({ settling: true, isLoading: true })
    rerender({ state: activation({ result: { kind: 'failed' } }) })
    expect(calls()[1][1]).toMatchObject({ outcome: 'failed' })
})

it('leaving during the wait reports left', () => {
    const { unmount } = track({ settling: true, selectedStatus: { state: 'setting_up' } })
    expect(calls()[0][1]).toEqual({ currency: 'ARS', found_pending: true })
    jest.advanceTimersByTime(9_000)
    unmount()
    expect(calls()[1]).toEqual(['local_account_wait_ended', { currency: 'ARS', outcome: 'left', wait_ms: 9_000 }])
})

it('a screen that never waits reports nothing', () => {
    const { rerender, unmount } = track({ allowed: true })
    rerender({ state: activation({ allowed: true }) })
    unmount()
    expect(calls()).toEqual([])
})
