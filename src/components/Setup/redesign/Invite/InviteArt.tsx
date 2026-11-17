'use client'

import { motion, useAnimationControls } from 'framer-motion'
import Image from 'next/image'
import { useEffect } from 'react'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { ContactCard } from './ContactCard'
import { InviteBurst } from './InviteBurst'
import { INVITE_LAYOUT } from './invite-art.consts'

/**
 * 04's hero (mock screen.js mount/enter/celebrate): the friend's card and yours, each with a reward star, a
 * sparkle between them, and the peanut, waving until a friend is found, then cheering. Both poses stay mounted
 * and one shows by opacity; the boxes never move. Entrance once: cards deal, stars stamp at 400 ms + 80 ms,
 * sparkle pops at 560 ms. `foundBeat` plays the found event; `missed` dims the friend card and drops the sparkle.
 */
export function InviteArt({
    friendHandle,
    ownHandle,
    found,
    missed,
    foundBeat,
}: {
    friendHandle: string
    ownHandle: string
    found: boolean
    missed: boolean
    foundBeat: number
}) {
    const { reducedMotion } = useSetupShell()
    const device = useShellDevice()
    const layout = INVITE_LAYOUT[device]
    const [sparkLeft, sparkTop, sparkWidth] = layout.spark
    const pulse = useAnimationControls()
    useEffect(() => {
        if (!foundBeat || reducedMotion) return
        void pulse.start({ rotate: [0, 30, 0], scale: [1, 1.7, 1], transition: { duration: 0.38, delay: 0.42 } })
    }, [foundBeat, reducedMotion, pulse])
    // ArtPiece adds the shell's 100 ms art delay; these are the mock's offsets after it
    return (
        <>
            <div className={`transition-opacity duration-fast ${found ? 'opacity-0' : 'opacity-100'}`}>
                <MascotStage
                    pose="waving-hello"
                    left={layout.wave[0]}
                    top={layout.wave[1]}
                    width={layout.wave[2]}
                    zIndex={4}
                />
            </div>
            <div className={`transition-opacity duration-fast ${found ? 'opacity-100' : 'opacity-0'}`}>
                <MascotStage
                    pose="cheering"
                    left={layout.cheer[0]}
                    top={layout.cheer[1]}
                    width={layout.cheer[2]}
                    beat={foundBeat}
                    zIndex={4}
                />
            </div>
            <ContactCard
                handle={friendHandle}
                testId="setup-redesign-invite-friend-card"
                left={layout.friend[0]}
                top={layout.friend[1]}
                rotate={layout.friend[2]}
                delay={0}
                starDelay={0.4}
                swing={1}
                beat={foundBeat}
                dimmed={missed}
                zIndex={5}
            />
            <ContactCard
                handle={ownHandle}
                left={layout.me[0]}
                top={layout.me[1]}
                rotate={layout.me[2]}
                delay={0.09}
                starDelay={0.48}
                swing={-1}
                beat={foundBeat}
                zIndex={6}
            />
            <ArtPiece
                left={sparkLeft}
                top={sparkTop}
                width={sparkWidth}
                rotate={-20}
                entrance="pop"
                delay={0.46}
                zIndex={8}
            >
                <div className={`transition-opacity duration-fast ${missed ? 'opacity-0' : 'opacity-100'}`}>
                    <motion.div animate={pulse}>
                        <Image src={sparkle} alt="" className="h-auto w-full" />
                    </motion.div>
                </div>
            </ArtPiece>
            {layout.deco.map(([left, top, width, kind], i) => (
                <ArtPiece
                    key={i}
                    left={left}
                    top={top}
                    width={width}
                    rotate={kind === 'sparkle' ? -20 : 0}
                    entrance="pop"
                    delay={0.52 + i * 0.06}
                    zIndex={7}
                    smHide
                >
                    <Image src={kind === 'sparkle' ? sparkle : star} alt="" className="h-auto w-full" />
                </ArtPiece>
            ))}
            {foundBeat > 0 && !reducedMotion && (
                <InviteBurst key={foundBeat} centerX={sparkLeft + sparkWidth / 2} centerY={sparkTop + sparkWidth / 2} />
            )}
        </>
    )
}
