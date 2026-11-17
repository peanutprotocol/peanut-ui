'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import star from '@/assets/illustrations/star.svg'
import firstInvite from '@/assets/onboarding/first-invite-white.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

/**
 * 09 hero (mock screens/09-email, composition B): the approved FIRST_INVITE badge held by the got-it glove at its
 * corner, two stars. It stamps in once and holds; `beat` (a new valid address) pops the badge once.
 */
export function EmailArt({ beat }: { beat: number }) {
    const { reducedMotion } = useSetupShell()
    return (
        <div className="absolute inset-0" data-testid="setup-redesign-art">
            <ArtPiece left={42} top={172} width={244} rotate={6} entrance="stamp" zIndex={5}>
                <motion.div
                    key={beat}
                    initial={false}
                    animate={
                        beat > 0 && !reducedMotion
                            ? { scale: [1, 1.08, 1], rotate: [0, -3, 0], transition: { duration: 0.36, delay: 0.08 } }
                            : undefined
                    }
                    style={{ transformOrigin: '50% 60%' }}
                >
                    <Image
                        src={firstInvite}
                        alt=""
                        className="block h-auto w-full drop-shadow-[4px_4px_0_var(--color-border-default)]"
                    />
                </motion.div>
            </ArtPiece>
            <ArtPiece left={220} top={284} width={128} rotate={-14} entrance="pop" order={3} zIndex={6}>
                <Image src={gotItHand} alt="" className="block h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={316} top={190} width={30} entrance="pop" order={4} zIndex={7} smHide>
                <Image src={star} alt="" className="block h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={26} top={372} width={20} entrance="pop" order={5} zIndex={7} smHide>
                <Image src={star} alt="" className="block h-auto w-full" />
            </ArtPiece>
        </div>
    )
}
