'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useLayoutEffect, useRef } from 'react'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { letterAvatarSrc } from '@/components/Avatar/avatar.utils'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'

// Mock 02-username screen.js: the card's and the glove's resting tilts.
const CARD_ROTATE = -4
const GLOVE_ROTATE = 12

/** Shrinks the text to fit its box: from `max` down to `min` px. Past `min` (a name over 12 letters) it ends in an
 *  ellipsis, as the mock's card does, instead of being cut at the card edge (review R2-09). */
function useFitText(text: string, max: number, min: number) {
    const ref = useRef<HTMLSpanElement>(null)
    useLayoutEffect(() => {
        const node = ref.current
        if (!node) return
        let size = max
        node.style.fontSize = `${size}px`
        while (size > min && node.scrollWidth > node.clientWidth) node.style.fontSize = `${--size}px`
    }, [text, max, min])
    return ref
}

/**
 * The 02 hero: a profile card with the letter avatar, @name and peanut.me/name, the waving glove and the stars.
 * The card is a UI object (code); the glove and stars are the approved illustrations. A landed roll flips the card
 * in with the new name and flicks the glove (mock 02-username roll()).
 */
export function UsernameProfileArt({ name, rolls, rolling }: { name: string; rolls: number; rolling: boolean }) {
    const { reducedMotion } = useSetupShell()
    const nameRef = useFitText(name, 22, 14)
    const linkRef = useFitText(name, 13, 10)
    const avatar = letterAvatarSrc(name)
    const flip = rolls > 0 && !reducedMotion

    return (
        <>
            <ArtPiece left={50} top={244} width={262} height={100} rotate={CARD_ROTATE} entrance="stamp" zIndex={5}>
                <motion.div
                    className="shadow-2 absolute inset-0 rounded-sm border border-border-button bg-background-default"
                    animate={{
                        opacity: rolling && !reducedMotion ? 1 : 0,
                        x: rolling ? 10 : 0,
                        y: rolling ? 8 : 0,
                        rotate: 7,
                    }}
                    transition={{ duration: 0.2 }}
                />
                <motion.div
                    key={rolling ? 'rolling' : rolls}
                    data-testid="username-card"
                    className="absolute inset-0 flex items-center gap-3.5 rounded-sm border border-border-button bg-background-default p-4 shadow-4"
                    style={{ transformPerspective: 700 }}
                    initial={flip && !rolling ? { rotateY: -90 } : false}
                    animate={{ rotateY: rolling && !reducedMotion ? 38 : 0 }}
                    transition={rolling ? { duration: 0.3 } : { duration: 0.22, ease: 'easeOut' }}
                >
                    {avatar ? (
                        <Image src={avatar} alt="" width={64} height={64} className="size-16 shrink-0" />
                    ) : (
                        <span className="size-16 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                        <span
                            ref={nameRef}
                            className="block overflow-hidden leading-[26px] font-black text-ellipsis whitespace-nowrap text-foreground-primary"
                        >
                            {`@${name}`}
                        </span>
                        <span
                            ref={linkRef}
                            className="block overflow-hidden leading-[18px] font-semibold text-ellipsis whitespace-nowrap text-foreground-secondary"
                        >
                            {`peanut.me/${name}`}
                        </span>
                    </span>
                </motion.div>
            </ArtPiece>
            <ArtPiece left={284} top={326} width={84} rotate={GLOVE_ROTATE} entrance="pop" delay={0.2} zIndex={6}>
                <motion.div
                    key={rolls}
                    style={{ transformOrigin: '30% 92%' }}
                    animate={flip ? { rotate: [0, -14, 30, -6, 10, 0], y: [0, 5, -16, 0, 0, 0] } : undefined}
                    transition={{ duration: 0.64, ease: 'easeOut', times: [0, 0.16, 0.42, 0.64, 0.82, 1] }}
                >
                    <Image src={handWaving} alt="" className="h-auto w-full" />
                </motion.div>
            </ArtPiece>
            <ArtPiece left={40} top={206} width={22} entrance="pop" order={3} smHide zIndex={7}>
                <Image src={star} alt="" className="h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={330} top={214} width={28} entrance="pop" order={4} smHide zIndex={7}>
                <Image src={star} alt="" className="h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={300} top={196} width={26} rotate={-20} entrance="pop" order={5} smHide zIndex={7}>
                <Image src={sparkle} alt="" className="h-auto w-full" />
            </ArtPiece>
        </>
    )
}
