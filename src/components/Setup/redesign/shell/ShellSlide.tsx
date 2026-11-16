'use client'

import { motion, PresenceContext, useIsPresent } from 'framer-motion'
import { type ReactNode, useContext, useMemo, useRef } from 'react'
import { SetupSlideContext } from './SetupShellContext'

/**
 * One screen in the step transition. It draws nothing itself: its variant labels drive the stage, panel and
 * art layers of the SetupScreen inside it. A leaving slide takes the new step's direction from AnimatePresence,
 * so Back slides the old stage off to the right.
 */
export function ShellSlide({
    slideKey,
    direction,
    children,
}: {
    slideKey: string
    direction: number
    children: ReactNode
}) {
    const isPresent = useIsPresent()
    const presence = useContext(PresenceContext)
    const enterDirection = useRef(direction).current
    const current = isPresent ? enterDirection : ((presence?.custom as number | undefined) ?? enterDirection)
    const value = useMemo(() => ({ key: slideKey, direction: current }), [slideKey, current])
    return (
        <motion.div
            className="absolute inset-0"
            initial="enter"
            animate="center"
            exit="exit"
            data-setup-slide={slideKey}
            aria-hidden={!isPresent || undefined}
        >
            <SetupSlideContext.Provider value={value}>{children}</SetupSlideContext.Provider>
        </motion.div>
    )
}
