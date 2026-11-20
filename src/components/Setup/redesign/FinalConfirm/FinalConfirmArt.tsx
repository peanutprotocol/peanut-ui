'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import star from '@/assets/illustrations/star.svg'
import { Icon } from '@/components/Global/Icons/Icon'
import { ScanFrame } from '@/components/Global/ScanFrame'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/** The scan frame in art-box px (mock BRK). */
const FRAME = { left: 120, top: 196, width: 150, height: 176 }
// The too-cool peanut inside the frame, in frame px: its drawn figure is 148 px tall, centred, 14 px under the top.
const MASCOT = { left: -25, top: -9, width: 198 }

/**
 * 11 hero (mock screens/11-final-confirm, r9 S9): the scan frame holds the too-cool peanut; the USD and EUR coin
 * characters stand beside it, outside it, at one face size, mirrored about the frame on its bottom line, tilted
 * -8 and +8 degrees. `scanning` runs the scan line while the passkey sheet is open; `locked` stamps the check.
 */
export function FinalConfirmArt({ scanning, locked }: { scanning: boolean; locked: boolean }) {
    const { reducedMotion } = useSetupShell()
    return (
        <div className="absolute inset-0" data-testid="setup-redesign-art">
            <ArtPiece
                left={FRAME.left}
                top={FRAME.top}
                width={FRAME.width}
                height={FRAME.height}
                entrance="pop"
                zIndex={5}
            >
                <div className="absolute inset-0" data-testid="setup-redesign-final-confirm-frame">
                    <motion.div
                        className="absolute inset-0"
                        animate={{ scale: locked ? 0.95 : 1 }}
                        transition={{ duration: reducedMotion ? 0 : 0.34 }}
                    >
                        <ScanFrame scanLine={scanning && !reducedMotion} className="absolute inset-0">
                            <MascotStage pose="too-cool" {...MASCOT} />
                        </ScanFrame>
                    </motion.div>
                </div>
            </ArtPiece>
            <CoinCharacter
                coin="usd"
                left={27}
                top={292}
                size={90}
                rotate={-8}
                entrance="pop"
                order={2}
                playAfterMs={520}
                zIndex={6}
            />
            <CoinCharacter
                coin="eur"
                left={268}
                top={287}
                size={100}
                rotate={8}
                entrance="pop"
                order={3}
                playAfterMs={600}
                zIndex={6}
            />
            {locked && (
                <ArtPiece
                    left={FRAME.left + FRAME.width / 2 - 24}
                    top={FRAME.top + FRAME.height - 24}
                    width={48}
                    height={48}
                    entrance="stamp"
                    zIndex={8}
                >
                    <span
                        className="flex size-12 items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse"
                        data-scan-locked
                    >
                        <Icon name="check" size={24} strokeWidth={3} />
                    </span>
                </ArtPiece>
            )}
            <ArtPiece left={62} top={214} width={22} entrance="pop" order={4} zIndex={7} smHide>
                <Image src={star} alt="" className="block h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={306} top={214} width={22} entrance="pop" order={5} zIndex={7} smHide>
                <Image src={star} alt="" className="block h-auto w-full" />
            </ArtPiece>
        </div>
    )
}
