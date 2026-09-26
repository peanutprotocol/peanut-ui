/**
 * usePerkHoldToClaim — analytics lifecycle under StrictMode, and the
 * failed-payout guard.
 *
 * The old page fired REWARD_CLAIM_DISMISSED from a bare unmount effect; a
 * StrictMode mount/unmount/mount cycle would have fired a phantom dismissal
 * the moment the tracking ref was armed. The hook defers the capture one tick
 * and cancels it on remount, so only a REAL unmount reports a dismissal.
 *
 * The API keeps `eligible: true` on a failed payout (entitlement survives for
 * reconciliation), so `eligible` alone is not "claimable": a failed payout
 * offers no hold, no celebration, no shown/claimed events — through the UI
 * gesture and through a direct call alike. A pending payout is a reserved
 * reward and keeps the full celebration; a legacy response without
 * `payoutStatus` behaves as before.
 */
import React from 'react'
import posthog from 'posthog-js'
import { render, act } from '@testing-library/react'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { notifyHaptic, vibrateHaptic } from '@/utils/haptics'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

jest.mock('@/utils/confetti', () => ({
    shootDoubleStarConfetti: jest.fn(),
}))

jest.mock('@/utils/haptics', () => ({
    cancelHaptic: jest.fn(),
    notifyHaptic: jest.fn(),
    vibrateHaptic: jest.fn(),
}))

import { usePerkHoldToClaim } from '../usePerkHoldToClaim'
import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'

const eligibleQrPayment = {
    id: 'qp1',
    externalId: 'ext1',
    details: { merchant: { name: 'Test Merchant' } },
    perk: { eligible: true, claimed: false, amountSponsored: 0.5, discountPercentage: 5 },
} as any

const withPayout = (payoutStatus: 'pending' | 'completed' | 'failed') => ({
    ...eligibleQrPayment,
    perk: { ...eligibleQrPayment.perk, usageId: 'usage-1', payoutStatus },
})

const mockSetQrPayment = jest.fn()
let latest: ReturnType<typeof usePerkHoldToClaim> | null = null

function Harness({ qrPayment }: { qrPayment: any }) {
    latest = usePerkHoldToClaim(qrPayment, mockSetQrPayment)
    return null
}

const rewardEvents = () =>
    (posthog.capture as jest.Mock).mock.calls
        .map(([event]) => event)
        .filter((event) => ['reward_claim_shown', 'surprise_moment_shown', 'reward_claimed'].includes(event))

beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    latest = null
})

afterEach(() => {
    jest.useRealTimers()
})

test('StrictMode double-mount fires reward_claim_shown once and no phantom dismissal', () => {
    const { unmount } = render(
        <React.StrictMode>
            <Harness qrPayment={eligibleQrPayment} />
        </React.StrictMode>
    )

    // strict mode ran mount → unmount → mount; the deferred dismissal from the
    // fake unmount must have been cancelled by the remount
    act(() => {
        jest.runOnlyPendingTimers()
    })
    expect(posthog.capture).toHaveBeenCalledWith('reward_claim_shown', expect.any(Object))
    expect((posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === 'reward_claim_shown')).toHaveLength(
        1
    )
    expect(posthog.capture).not.toHaveBeenCalledWith('reward_claim_dismissed')

    // a REAL unmount after the perk was shown and never claimed reports exactly
    // one dismissal
    unmount()
    act(() => {
        jest.runOnlyPendingTimers()
    })
    expect(
        (posthog.capture as jest.Mock).mock.calls.filter(([event]) => event === 'reward_claim_dismissed')
    ).toHaveLength(1)
})

test('no dismissal when the perk was never shown', () => {
    const { unmount } = render(
        <React.StrictMode>
            <Harness qrPayment={{ ...eligibleQrPayment, perk: undefined }} />
        </React.StrictMode>
    )
    unmount()
    act(() => {
        jest.runOnlyPendingTimers()
    })
    expect(posthog.capture).not.toHaveBeenCalledWith('reward_claim_dismissed')
})

test('a keyed remount (same flow re-keyed by qrCode|timestamp) does not fire a phantom dismissal', () => {
    // qr-pay/page.tsx remounts the whole flow under a new key — a NEW hook
    // instance mounts while the previous one unmounts. The cancel must span
    // instances, or every re-scan/refresh inflates reward_claim_dismissed.
    const { rerender } = render(<Harness key="scan-1" qrPayment={eligibleQrPayment} />)
    rerender(<Harness key="scan-2" qrPayment={eligibleQrPayment} />)

    act(() => {
        jest.runOnlyPendingTimers()
    })
    expect(posthog.capture).not.toHaveBeenCalledWith('reward_claim_dismissed')
})

describe('failed payout (eligible kept for reconciliation)', () => {
    test('offers nothing: no shown/surprise events, no dismissal, rewardOffered false', () => {
        const { unmount } = render(<Harness qrPayment={withPayout('failed')} />)
        expect(latest?.rewardOffered).toBe(false)
        expect(rewardEvents()).toEqual([])

        unmount()
        act(() => {
            jest.runOnlyPendingTimers()
        })
        // never shown, so never dismissed
        expect(posthog.capture).not.toHaveBeenCalledWith('reward_claim_dismissed')
    })

    test('a direct startHold starts nothing: no shake, no progress, no vibration, no celebration, no claimed event', () => {
        render(<Harness qrPayment={withPayout('failed')} />)
        act(() => {
            latest!.startHold()
        })
        expect(latest?.isShaking).toBe(false)
        act(() => {
            jest.advanceTimersByTime(PERK_HOLD_DURATION_MS / 2)
        })
        expect(latest?.isShaking).toBe(false)
        expect(latest?.holdProgress).toBe(0)
        expect(latest?.shakeIntensity).toBe('none')
        expect(vibrateHaptic).not.toHaveBeenCalled()
        act(() => {
            jest.advanceTimersByTime(PERK_HOLD_DURATION_MS)
        })
        expect(shootDoubleStarConfetti).not.toHaveBeenCalled()
        expect(notifyHaptic).not.toHaveBeenCalled()
        expect(rewardEvents()).toEqual([])
        expect(mockSetQrPayment).not.toHaveBeenCalled()
        expect(latest?.perkClaimed).toBe(false)
    })

    test('a hold armed on a pending reward that turns failed before the timer fires does not celebrate, and the shake stops', () => {
        const { rerender } = render(<Harness qrPayment={withPayout('pending')} />)
        act(() => {
            latest!.startHold()
        })
        act(() => {
            jest.advanceTimersByTime(PERK_HOLD_DURATION_MS / 2)
        })
        expect(latest?.isShaking).toBe(true)

        rerender(<Harness qrPayment={withPayout('failed')} />)
        expect(latest?.isShaking).toBe(false)
        expect(latest?.holdProgress).toBe(0)

        act(() => {
            jest.advanceTimersByTime(PERK_HOLD_DURATION_MS)
        })
        expect(shootDoubleStarConfetti).not.toHaveBeenCalled()
        expect(notifyHaptic).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith('reward_claimed', expect.anything())
        expect(mockSetQrPayment).not.toHaveBeenCalled()
        expect(latest?.perkClaimed).toBe(false)
    })
})

describe.each([
    ['pending payout (reserved, settles later)', withPayout('pending')],
    ['completed payout', withPayout('completed')],
    ['legacy response without payoutStatus', eligibleQrPayment],
])('%s', (_label, qrPayment) => {
    test('is offered, and the hold celebrates with the payout state preserved on the reveal', () => {
        render(<Harness qrPayment={qrPayment} />)
        expect(latest?.rewardOffered).toBe(true)
        expect(rewardEvents()).toEqual(['reward_claim_shown', 'surprise_moment_shown'])

        act(() => {
            latest!.startHold()
        })
        act(() => {
            jest.advanceTimersByTime(PERK_HOLD_DURATION_MS + 100)
        })
        expect(shootDoubleStarConfetti).toHaveBeenCalledTimes(1)
        expect(notifyHaptic).toHaveBeenCalledWith('success')
        expect(posthog.capture).toHaveBeenCalledWith('reward_claimed', { amount_usd: 0.5, discount_pct: 5 })
        expect(latest?.perkClaimed).toBe(true)
        // the reveal flag is written; the payout state is untouched
        expect(mockSetQrPayment).toHaveBeenCalledTimes(1)
        expect(mockSetQrPayment).toHaveBeenCalledWith({
            ...qrPayment,
            perk: { ...qrPayment.perk, claimed: true },
        })
    })
})
