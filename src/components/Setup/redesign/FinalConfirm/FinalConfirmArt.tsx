'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import star from '@/assets/illustrations/star.svg'
import { Icon } from '@/components/Global/Icons/Icon'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/** The scan frame in art-box px (mock BRK). */
const FRAME = { left: 120, top: 196, width: 150, height: 176 }
const FACE = 72
// The app scanner's corner marks (the passkey motif): one 4 px ink corner each, as in QrArgentinaScanFrame.
const CORNERS = [
    'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
    'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
]

/**
 * 11 hero (mock screens/11-final-confirm, r9 S9): the scan frame holds the app's `smile` icon; the USD and EUR coin
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
                        data-scan-frame
                    >
                        {CORNERS.map((corner) => (
                            <span
                                key={corner}
                                aria-hidden
                                className={`absolute size-[34px] border-border-default ${corner}`}
                            />
                        ))}
                    </motion.div>
                    <span
                        className="absolute flex items-center justify-center text-foreground-primary"
                        style={{
                            left: (FRAME.width - FACE) / 2,
                            top: (FRAME.height - FACE) / 2,
                            width: FACE,
                            height: FACE,
                        }}
                        data-scan-face
                    >
                        {/* the stroke as heavy as the 4 px corners at this size */}
                        <Icon name="smile" size={FACE} strokeWidth={(4 * 24) / FACE} />
                    </span>
                    {scanning && !reducedMotion && (
                        <motion.span
                            aria-hidden
                            className="shadow-2 absolute h-1.5 rounded-full border-[1.5px] border-border-default bg-background-default"
                            style={{ left: 12, top: 12, width: FRAME.width - 24 }}
                            initial={{ y: 0 }}
                            animate={{ y: FRAME.height - 30 }}
                            transition={{
                                duration: 0.52,
                                repeat: Infinity,
                                repeatType: 'reverse',
                                ease: [0.5, 0, 0.5, 1],
                            }}
                        />
                    )}
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
