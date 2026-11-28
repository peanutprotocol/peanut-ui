import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { LOAD_FALLBACK_MS, PeanutBuddy, WHIMSY_EXIT_SLIDE_MS, WHIMSY_WAVE_MS } from '../components/PeanutBuddy'

let latestMascotCallbacks: {
    onLoaded?: () => void
    onLanded?: () => void
    onLoadFailed?: () => void
} = {}

jest.mock('framer-motion', () => {
    const ReactLib = require('react')
    const stripMotionProps = (props: Record<string, unknown>) => {
        const rest = { ...props }
        delete rest.initial
        delete rest.animate
        delete rest.exit
        delete rest.transition
        delete rest.whileTap
        return rest
    }
    return {
        useReducedMotion: () => false,
        motion: {
            aside: ReactLib.forwardRef(({ children, ...props }: Record<string, unknown>, ref: unknown) =>
                ReactLib.createElement('aside', { ...stripMotionProps(props), ref }, children)
            ),
            div: ReactLib.forwardRef(({ children, ...props }: Record<string, unknown>, ref: unknown) =>
                ReactLib.createElement('div', { ...stripMotionProps(props), ref }, children)
            ),
            button: ReactLib.forwardRef(({ children, ...props }: Record<string, unknown>, ref: unknown) =>
                ReactLib.createElement('button', { ...stripMotionProps(props), ref }, children)
            ),
        },
    }
})

jest.mock('../components/PeanutBuddyMascot', () => ({
    PeanutBuddyMascot: ({
        onLoaded,
        onLanded,
        onLoadFailed,
    }: {
        onLoaded?: () => void
        onLanded?: () => void
        onLoadFailed?: () => void
    }) => {
        latestMascotCallbacks = { onLoaded, onLanded, onLoadFailed }
        return <div data-testid="mock-mascot" />
    },
}))

const BASE_PROPS = {
    pose: 'waving-hello' as const,
    prompt: 'Need help?',
    ctaLabel: 'Get help',
    dismissLabel: 'Dismiss',
    mascotLabel: 'Peanut helper',
    clearance: 'bottom-nav' as const,
}

describe('PeanutBuddy load fallback vs walk-in timing', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        latestMascotCallbacks = {}
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('keeps home_wave alive when assets load at 1.2s and the walk ends at 2.0s', () => {
        const onImpression = jest.fn()
        const onAutoLeave = jest.fn()

        render(
            <PeanutBuddy
                {...BASE_PROPS}
                whimsy
                onImpression={onImpression}
                onAction={jest.fn()}
                onDismiss={jest.fn()}
                onAutoLeave={onAutoLeave}
            />
        )

        expect(screen.getByTestId('peanut-buddy-whimsy')).toBeTruthy()
        expect(screen.getByTestId('peanut-buddy-mascot-btn').getAttribute('tabindex')).toBe('-1')

        // Assets finish loading at 1.2s (inside LOAD_FALLBACK_MS = 1.5s), walk continues past 1.5s.
        act(() => {
            jest.advanceTimersByTime(1_200)
            latestMascotCallbacks.onLoaded?.()
        })

        // Advance past LOAD_FALLBACK_MS (1.5s) to 1.99s: cameo must NOT bail during walk-in.
        act(() => {
            jest.advanceTimersByTime(790)
        })
        expect(onAutoLeave).not.toHaveBeenCalled()
        expect(onImpression).not.toHaveBeenCalled()
        expect(screen.getByTestId('peanut-buddy-whimsy')).toBeTruthy()

        // Walk + hop-turn finishes at 2.0s and cameo lands cleanly.
        act(() => {
            jest.advanceTimersByTime(10)
            latestMascotCallbacks.onLanded?.()
        })
        expect(onAutoLeave).not.toHaveBeenCalled()
        expect(onImpression).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('peanut-buddy-mascot-btn').getAttribute('tabindex')).toBe('0')

        // Wave completes after WHIMSY_WAVE_MS and starts exit slide; auto-leave waits for WHIMSY_EXIT_SLIDE_MS.
        act(() => {
            jest.advanceTimersByTime(WHIMSY_WAVE_MS)
        })
        expect(onAutoLeave).not.toHaveBeenCalled()

        act(() => {
            jest.advanceTimersByTime(WHIMSY_EXIT_SLIDE_MS - 1)
        })
        expect(onAutoLeave).not.toHaveBeenCalled()

        act(() => {
            jest.advanceTimersByTime(1)
        })
        expect(onAutoLeave).toHaveBeenCalledTimes(1)
    })

    it('bails whimsy if asset loading genuinely stalls past LOAD_FALLBACK_MS', () => {
        const onImpression = jest.fn()
        const onAutoLeave = jest.fn()

        render(
            <PeanutBuddy
                {...BASE_PROPS}
                whimsy
                onImpression={onImpression}
                onAction={jest.fn()}
                onDismiss={jest.fn()}
                onAutoLeave={onAutoLeave}
            />
        )

        act(() => {
            jest.advanceTimersByTime(LOAD_FALLBACK_MS)
        })

        expect(onAutoLeave).toHaveBeenCalledTimes(1)
        expect(onImpression).not.toHaveBeenCalled()
    })

    it('bails whimsy once on real asset load failure and does not double-fire on timer', () => {
        const onImpression = jest.fn()
        const onAutoLeave = jest.fn()

        render(
            <PeanutBuddy
                {...BASE_PROPS}
                whimsy
                onImpression={onImpression}
                onAction={jest.fn()}
                onDismiss={jest.fn()}
                onAutoLeave={onAutoLeave}
            />
        )

        act(() => {
            jest.advanceTimersByTime(300)
            latestMascotCallbacks.onLoadFailed?.()
        })
        expect(onAutoLeave).toHaveBeenCalledTimes(1)
        expect(onImpression).not.toHaveBeenCalled()
        expect(screen.queryByTestId('peanut-buddy-whimsy')).toBeNull()

        act(() => {
            jest.advanceTimersByTime(LOAD_FALLBACK_MS)
        })
        expect(onAutoLeave).toHaveBeenCalledTimes(1)
    })

    it('waits for walk touchdown before revealing non-whimsy bubble once assets load', () => {
        const onImpression = jest.fn()

        render(<PeanutBuddy {...BASE_PROPS} onImpression={onImpression} onAction={jest.fn()} onDismiss={jest.fn()} />)

        act(() => {
            jest.advanceTimersByTime(1_200)
            latestMascotCallbacks.onLoaded?.()
        })

        // Past 1.5s while still walking: bubble waits for touchdown rather than popping early.
        act(() => {
            jest.advanceTimersByTime(500)
        })
        expect(onImpression).not.toHaveBeenCalled()

        // Touchdown at 2.0s reveals bubble and reports impression once.
        act(() => {
            jest.advanceTimersByTime(300)
            latestMascotCallbacks.onLanded?.()
        })
        expect(onImpression).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Need help?')).toBeTruthy()
    })

    it('reveals non-whimsy stuck bubble if asset loading stalls past LOAD_FALLBACK_MS', () => {
        const onImpression = jest.fn()

        render(<PeanutBuddy {...BASE_PROPS} onImpression={onImpression} onAction={jest.fn()} onDismiss={jest.fn()} />)

        act(() => {
            jest.advanceTimersByTime(LOAD_FALLBACK_MS)
        })
        expect(onImpression).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Need help?')).toBeTruthy()
    })
})
