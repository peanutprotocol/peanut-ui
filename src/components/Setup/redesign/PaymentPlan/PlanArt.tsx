'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { ReactNode } from 'react'
import QRCode from 'react-qr-code'
import { LOGO } from '@/assets/brand'
import { CardFace } from '@/components/Setup/redesign/shell/CardFace'
import { StarDoodles, type StarSpec } from '@/components/Setup/redesign/shell/StarDoodles'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/** Which hero piece answers the last pick, and a counter that replays its hop. */
export type PlanHop = { piece: 'card' | 'qr' | 'coin'; beat: number } | null

const STARS: readonly StarSpec[] = [
    { left: 350, top: 214, size: 24 },
    { left: 214, top: 392, size: 18 },
    { left: 36, top: 236, size: 16, sparkle: true },
]

/** One hop when a pick lands on this piece (an event beat; it ends still). Reduced motion: no hop. */
function Hop({ piece, hop, children }: { piece: 'card' | 'qr' | 'coin'; hop: PlanHop; children: ReactNode }) {
    const { reducedMotion } = useSetupShell()
    const beat = !reducedMotion && hop?.piece === piece ? hop.beat : 0
    return (
        <motion.div
            key={beat}
            initial={beat ? { y: 0 } : false}
            animate={
                beat
                    ? {
                          y: [0, piece === 'coin' ? -8 : -14, 0, 0],
                          scaleX: [1, 1.06, 1.05, 1],
                          scaleY: [1, 1.06, 0.95, 1],
                      }
                    : {}
            }
            transition={{ duration: 0.4, times: [0, 0.4, 0.75, 1], ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    )
}

/**
 * The 08 hero (mock 08-payment-plan/screen.js): the card face and a QR tile (UI objects) with the USD coin character
 * between them, and stars. Positions are the mock's 440-high art box; the compact stage on a small phone (300 high)
 * moves everything up 140 px. The QR encodes peanut.me. The QR tile shows only to residents of the QR-payment
 * countries (Argentina, Brazil; FLEET-RULES 9); elsewhere the same hero shows without it.
 */
export function PlanArt({ compact, hop, showQr }: { compact: boolean; hop: PlanHop; showQr: boolean }) {
    const dy = compact ? -140 : 0
    return (
        <>
            <ArtPiece left={18} top={282 + dy} rotate={-9} entrance="deal" zIndex={6}>
                <Hop piece="card" hop={hop}>
                    <CardFace width={170} />
                </Hop>
            </ArtPiece>
            {showQr && (
                <ArtPiece left={258} top={262 + dy} rotate={6} entrance="deal" order={1} zIndex={6}>
                    <Hop piece="qr" hop={hop}>
                        <div
                            className="relative rounded-sm border-2 border-border-default bg-background-default p-1 shadow-4"
                            data-testid="setup-redesign-plan-qr"
                        >
                            <QRCode value="https://peanut.me" size={104} level="H" />
                            <Image
                                src={LOGO}
                                alt=""
                                className="absolute top-1/2 left-1/2 h-auto w-5 -translate-x-1/2 -translate-y-1/2"
                            />
                        </div>
                    </Hop>
                </ArtPiece>
            )}
            <ArtPiece left={166} top={252 + dy} width={100} height={100} rotate={-10} zIndex={8}>
                <Hop piece="coin" hop={hop}>
                    <div className="relative size-[100px]">
                        <CoinCharacter
                            coin="usd"
                            left={0}
                            top={0}
                            size={100}
                            entrance="stamp"
                            order={2}
                            playAfterMs={640}
                        />
                    </div>
                </Hop>
            </ArtPiece>
            <StarDoodles stars={STARS.map((star) => ({ ...star, top: star.top + dy }))} order={4} />
        </>
    )
}
