/**
 * usePerkHoldToClaim — analytics lifecycle under StrictMode.
 *
 * The old page fired REWARD_CLAIM_DISMISSED from a bare unmount effect; a
 * StrictMode mount/unmount/mount cycle would have fired a phantom dismissal
 * the moment the tracking ref was armed. The hook defers the capture one tick
 * and cancels it on remount, so only a REAL unmount reports a dismissal.
 */
import React from 'react'
import posthog from 'posthog-js'
import { render, act } from '@testing-library/react'

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

const eligibleQrPayment = {
    id: 'qp1',
    externalId: 'ext1',
    details: { merchant: { name: 'Test Merchant' } },
    perk: { eligible: true, claimed: false, amountSponsored: 0.5, discountPercentage: 5 },
} as any

function Harness({ qrPayment }: { qrPayment: any }) {
    usePerkHoldToClaim(qrPayment, jest.fn())
    return null
}

beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
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
