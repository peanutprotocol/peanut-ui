/** @jest-environment jsdom */
/**
 * PerkClaimGiftBox — keyboard entry into the claim trigger.
 *
 * tabIndex made the gift box focusable (TASK-22452), which opened a NEW
 * path into onHoldComplete → perksApi.claimPerk (a money-moving call).
 * These tests pin that wiring: a held Enter completes the hold exactly
 * once while idle, and a non-idle phase rejects keyboard input entirely.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { PerkClaimGiftBox } from '@/components/Home/PerkClaimGiftBox'
import type { PendingPerk } from '@/services/perks'

jest.mock('@/utils/haptics', () => ({
    vibrateHaptic: jest.fn(),
    cancelHaptic: jest.fn(),
    impactHaptic: jest.fn(),
    heavyImpactHaptic: jest.fn(),
    notifyHaptic: jest.fn(),
}))

const perk = {
    id: 'perk-1',
    kind: 'INVITEE_FIRST_DEPOSIT',
    amountUsd: 5,
    meta: { inviteeUsername: 'testfriend' },
} as unknown as PendingPerk

// holdProgressPerSec is 80, so a held Enter needs 100/80 = 1.25s; fake timers
// drive both Date.now and the rAF loop.
const HOLD_MS = 3000

describe('PerkClaimGiftBox keyboard claim path', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    it('a held Enter completes the hold exactly once while idle', () => {
        const onHoldComplete = jest.fn()
        render(<PerkClaimGiftBox perk={perk} onHoldComplete={onHoldComplete} claimPhase="idle" />, {
            wrapper: IntlWrapper,
        })

        const box = screen.getByRole('button')
        expect(box).toHaveAttribute('tabindex', '0')
        expect(box).not.toHaveAttribute('aria-disabled')

        box.focus()
        fireEvent.keyDown(box, { key: 'Enter' })
        act(() => {
            jest.advanceTimersByTime(HOLD_MS)
        })

        expect(onHoldComplete).toHaveBeenCalledTimes(1)

        // keeping Enter held past completion must not re-fire
        act(() => {
            jest.advanceTimersByTime(HOLD_MS)
        })
        expect(onHoldComplete).toHaveBeenCalledTimes(1)
    })

    it('a non-idle phase rejects keyboard input and leaves the tab order', () => {
        const onHoldComplete = jest.fn()
        render(<PerkClaimGiftBox perk={perk} onHoldComplete={onHoldComplete} claimPhase="opening" />, {
            wrapper: IntlWrapper,
        })

        const box = screen.getByRole('button')
        expect(box).toHaveAttribute('tabindex', '-1')
        expect(box).toHaveAttribute('aria-disabled', 'true')

        fireEvent.keyDown(box, { key: 'Enter' })
        act(() => {
            jest.advanceTimersByTime(HOLD_MS)
        })
        expect(onHoldComplete).not.toHaveBeenCalled()
    })
})
