'use client'

import { motion } from 'framer-motion'
import { ScanFrame } from '@/components/Global/ScanFrame'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/**
 * The shared scan frame around the peanut, placed in the art box (a UI object). Its corners snap in once
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
                    <ScanFrame entrance={motionOn} className="absolute inset-0" />
                </motion.div>
            </motion.div>
        </ArtPiece>
    )
}
