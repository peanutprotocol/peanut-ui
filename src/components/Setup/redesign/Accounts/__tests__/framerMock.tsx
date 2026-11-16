/**
 * framer-motion for the redesign screen suites, used as
 * `jest.mock('framer-motion', () => require('<path>/framerMock').framerMotionForShell())`.
 *
 * The real framer-motion, AnimatePresence included: a footer label swap runs its 100 ms crossfade, so a test reads
 * a new label with `findBy…`/`waitFor`. `reduced` lets a suite answer useReducedMotion.
 */
export function framerMotionForShell(reduced?: () => boolean) {
    const actual = jest.requireActual('framer-motion')
    return {
        ...actual,
        ...(reduced ? { useReducedMotion: () => reduced() } : {}),
    }
}
