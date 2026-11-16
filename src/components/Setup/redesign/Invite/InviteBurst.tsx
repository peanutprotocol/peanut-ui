'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'

const PIECES = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
    const distance = i % 2 ? 72 : 56
    return {
        sparkle: i % 2 === 1,
        width: i % 2 ? 26 : 22,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        turn: i % 2 ? -1 : 1,
    }
})

/**
 * The found event's burst (mock burst()): eight approved stars and sparkles fly out from the point where the two
 * cards meet, 420 ms into the beat, and fade. Remounted per beat by the caller's key; never under reduced motion.
 */
export function InviteBurst({ centerX, centerY }: { centerX: number; centerY: number }) {
    return (
        <>
            {PIECES.map((piece, i) => (
                <motion.div
                    key={i}
                    aria-hidden="true"
                    className="pointer-events-none absolute z-[9]"
                    style={{
                        left: centerX - piece.width / 2,
                        top: centerY - piece.width / 2,
                        width: piece.width,
                    }}
                    initial={{ x: 0, y: 0, scale: 0.3, rotate: 0, opacity: 0 }}
                    animate={{
                        x: [0, piece.dx, piece.dx * 1.2],
                        y: [0, piece.dy, piece.dy * 1.2],
                        scale: [0.3, 1.1, 0.5],
                        rotate: [0, 40 * piece.turn, 70 * piece.turn],
                        opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.52, delay: 0.42, times: [0, 0.55, 1], ease: [0.22, 1, 0.36, 1] }}
                >
                    <Image src={piece.sparkle ? sparkle : star} alt="" className="h-auto w-full" />
                </motion.div>
            ))}
        </>
    )
}
