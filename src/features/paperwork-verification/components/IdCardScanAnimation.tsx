'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import idCardGlove from '@/assets/kyc/id-card-glove.svg'
import { twMerge } from '@/utils/tw'

// The card's face inside its black outline, in percent of the sticker box, and its tilt.
// The band is clipped to this box so it never runs over the glove.
const CARD_FACE = { left: '20.5%', top: '17%', width: '65%', height: '41%', transform: 'rotate(-8.7deg)' }

/**
 * The document screen's hero: the generated glove sticker holding up an ID card
 * (approved by Konrad, 2026-11-20, listed on /dev/ds/marketing/assets). It pops
 * in, then a flat scan band sweeps the card. Code only places and moves it.
 * Under reduced motion the band is left out: a still band sat over the card's face.
 */
export function IdCardScanAnimation({ className }: { className?: string }) {
    const reducedMotion = useReducedMotion()
    return (
        <motion.div
            aria-hidden
            className={twMerge('pointer-events-none', className)}
            initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        >
            <Image src={idCardGlove} alt="" fill className="object-contain" />
            {!reducedMotion && (
                <div className="absolute overflow-hidden rounded-lg" style={CARD_FACE}>
                    <motion.div
                        className="absolute inset-x-0 top-0 h-1/5 border-b-2 border-border-default bg-background-brand/40"
                        // y is in band heights: the card face is five bands tall
                        initial={{ y: '-100%' }}
                        animate={{ y: '500%' }}
                        transition={{
                            duration: 1.6,
                            delay: 0.4,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            ease: 'easeInOut',
                        }}
                        data-scan-band
                    />
                </div>
            )}
        </motion.div>
    )
}
