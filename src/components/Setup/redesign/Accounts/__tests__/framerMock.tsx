/**
 * framer-motion for the redesign screen suites, used as
 * `jest.mock('framer-motion', () => require('<path>/framerMock').framerMotionForShell())`.
 *
 * AnimatePresence renders its children directly. The shell render loop it first stood in for is fixed in SetupShell;
 * it stays because the footer's CrossfadeLabel swaps labels in AnimatePresence mode "wait", so under jsdom the old
 * label stays until its 100 ms exit ends, and these suites read the new label at once (07 compare, 10 denied fail
 * without it, boat 16 Nov). These suites do not test the step slide or the label fade. `reduced` lets a suite
 * answer useReducedMotion.
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
