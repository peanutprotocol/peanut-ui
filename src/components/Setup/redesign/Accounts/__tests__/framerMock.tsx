/**
 * framer-motion for the redesign screen suites, used as
 * `jest.mock('framer-motion', () => require('<path>/framerMock').framerMotionForShell())`.
 *
 * AnimatePresence renders its children directly. Reason: inside the real AnimatePresence, PresenceChild makes a
 * new PresenceContext value on every render (presenceAffectsLayout defaults to true, so its memo key holds
 * Math.random()); SetupScreen reads it through useIsPresent, re-renders, and its dependency-free layout effect
 * writes the shell store again, which re-renders SetupShell: "Maximum update depth exceeded" on the first mount
 * (seen on boat, 16 Nov, framer-motion 11.18.2). Reported to the foundation; these suites do not test the step
 * slide, only the screens. `reduced` lets a suite answer useReducedMotion.
 */
import type { ReactNode } from 'react'

export function framerMotionForShell(reduced?: () => boolean) {
    const actual = jest.requireActual('framer-motion')
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
        ...(reduced ? { useReducedMotion: () => reduced() } : {}),
    }
}
