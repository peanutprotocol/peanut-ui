/**
 * framer-motion for the redesign screen suites, used as
 * `jest.mock('framer-motion', () => require('<path>/framerMock').framerMotionForShell())`.
 *
 * The real framer-motion, with `reduced` answering useReducedMotion when a suite passes it. AnimatePresence is the
 * real one: the shell loop it used to stand in for is fixed in SetupShell (presenceAffectsLayout off, store writes
 * that change nothing are dropped).
 */
export function framerMotionForShell(reduced?: () => boolean) {
    const actual = jest.requireActual('framer-motion')
    return {
        ...actual,
        ...(reduced ? { useReducedMotion: () => reduced() } : {}),
    }
}
