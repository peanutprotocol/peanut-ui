'use client'

import { motion } from 'framer-motion'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { twMerge } from '@/utils/tw'

const CORNERS = [
    { id: 'tl', className: 'top-0 left-0 rounded-tl-lg border-t-4 border-l-4', from: { x: -12, y: -12 } },
    { id: 'tr', className: 'top-0 right-0 rounded-tr-lg border-t-4 border-r-4', from: { x: 12, y: -12 } },
    { id: 'bl', className: 'bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4', from: { x: -12, y: 12 } },
    { id: 'br', className: 'right-0 bottom-0 rounded-br-lg border-r-4 border-b-4', from: { x: 12, y: 12 } },
] as const

/**
 * The face-scan focus brackets around the peanut (a UI object, as the mock's kit.js brackets). They snap in once
 * (200 ms), flash twice when the passkey sheet is asked for (`flash`), and wobble once on a failure screen.
 */
export function PasskeyBrackets({
    left,
    top,
    width,
    height,
    flash = 0,
    wobble = false,
}: {
    left: number
    top: number
    width: number
    height: number
    /** Change it to flash the brackets twice. */
    flash?: number
    wobble?: boolean
}) {
    const { reducedMotion } = useSetupShell()
    const motionOn = !reducedMotion
    return (
        <ArtPiece left={left} top={top} width={width} height={height} zIndex={5}>
            <motion.div
                className="absolute inset-0"
                animate={motionOn && wobble ? { rotate: [0, -3, 3, 0] } : undefined}
                transition={{ duration: 0.4, times: [0, 0.25, 0.6, 1] }}
            >
                <motion.div
                    key={flash}
                    className="absolute inset-0"
                    animate={motionOn && flash ? { opacity: [1, 0.2, 1, 0.2, 1] } : undefined}
                    transition={{ duration: 0.4 }}
                >
                    {CORNERS.map((corner) => (
                        <motion.span
                            key={corner.id}
                            className={twMerge('absolute size-[34px] border-0 border-border-button', corner.className)}
                            initial={motionOn ? { ...corner.from, opacity: 0 } : false}
                            animate={{ x: 0, y: 0, opacity: 1 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        />
                    ))}
                </motion.div>
            </motion.div>
        </ArtPiece>
    )
}
