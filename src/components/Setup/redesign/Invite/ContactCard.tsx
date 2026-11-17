'use client'

import { motion, useAnimationControls } from 'framer-motion'
import Image from 'next/image'
import { useEffect } from 'react'
import star from '@/assets/illustrations/star.svg'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { personFrom } from '@/lib/person/person'

/**
 * One contact card in 04's hero (mock `.cw` + `.contact`): the person's avatar and @handle, with a reward star on
 * its corner, so "both of you" shows in the art. Deals in once; the star stamps on at `starDelay`. Each change of
 * `beat` plays the found event: the cards high-five (`swing` = +1 friend, -1 you) and the star spins.
 * `dimmed`: the miss look, the card at half opacity without its star (200 ms fade).
 */
export function ContactCard({
    handle,
    left,
    top,
    rotate,
    delay,
    starDelay,
    swing,
    beat,
    dimmed = false,
    zIndex,
    testId,
}: {
    handle: string
    left: number
    top: number
    rotate: number
    delay: number
    starDelay: number
    swing: 1 | -1
    beat: number
    dimmed?: boolean
    zIndex: number
    testId?: string
}) {
    const { reducedMotion } = useSetupShell()
    const person = personFrom({ username: handle })
    const five = useAnimationControls()
    const spin = useAnimationControls()
    useEffect(() => {
        if (!beat || reducedMotion) return
        void five.start({
            x: [0, -4, 8, -2, 0].map((v) => v * swing),
            y: [0, -8, 13, -2, 0].map((v) => v * swing),
            rotate: [0, -4, 7, -1, 0].map((v) => v * swing),
            transition: { duration: 0.56, delay: 0.12, times: [0, 0.3, 0.55, 0.8, 1], ease: 'easeInOut' },
        })
        // ends at 72 degrees: the five-point star looks as it did, so the next beat can start from 0
        void spin.start({
            scale: [1, 1.7, 0.9, 1],
            rotate: [0, -30, 80, 72],
            transition: { duration: 0.48, delay: swing > 0 ? 0.43 : 0.5, ease: 'easeOut' },
        })
    }, [beat, reducedMotion, swing, five, spin])
    return (
        <ArtPiece left={left} top={top} rotate={rotate} entrance="deal" delay={delay} zIndex={zIndex}>
            <div
                className={`transition-opacity duration-fast ${dimmed ? 'opacity-50' : 'opacity-100'}`}
                data-testid={testId}
            >
                <motion.div animate={five} className="relative">
                    <div className="flex items-center gap-2.5 rounded-sm border-2 border-border-default bg-background-default py-2.5 pr-3.5 pl-2.5 whitespace-nowrap shadow-4">
                        {person && <UserAvatar person={person} decorative className="size-11" />}
                        <b className="notranslate text-heading-card font-extrabold" translate="no">
                            {`@${handle}`}
                        </b>
                    </div>
                    <motion.div
                        className="absolute z-[2] w-8"
                        style={{ top: -17, right: -15 }}
                        initial={reducedMotion ? false : { opacity: 0, scale: 1.9, rotate: -50 }}
                        animate={{ opacity: dimmed ? 0 : 1, scale: 1, rotate: 0 }}
                        transition={{
                            default: { duration: 0.26, delay: starDelay, ease: [0.55, 0, 1, 0.45] },
                            opacity: { duration: 0.2, delay: dimmed ? 0 : starDelay },
                        }}
                    >
                        <motion.div animate={spin}>
                            <Image src={star} alt="" className="h-auto w-full" />
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
        </ArtPiece>
    )
}
