'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import detailsEur from '@/assets/star-lp/us-eu-details-eur.webp'
import detailsUsd from '@/assets/star-lp/us-eu-details-usd.webp'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { twMerge } from '@/utils/tw'
import { UsEuAccountCapture } from './UsEuAccountCapture'
import { UsEuAppLink } from './UsEuAppLink'
import type { UsEuAccountPairProps } from './usEuAccounts.types'

/**
 * Hero art: the app's real USD and EUR bank-details screens (fixtures
 * get-paid-details-usd / -eur, holder set to the page persona, numbers masked),
 * in the headline's order (US, then Europe), landing on top of each other like
 * two stickers; from lg they fan out side by side, USD under US and EUR under
 * Europe, so they grow without stacking taller. On phones each one nearly fills
 * the column and reaches a little into the gutter. The pair leads where the
 * CTA leads: the accounts screen.
 */
export function UsEuAccountPair({ className, surface, pairedEntrance = false }: UsEuAccountPairProps = {}) {
    const pairRef = useRef<HTMLDivElement | null>(null)
    const [motionAllowed, setMotionAllowed] = useState(false)
    useEffect(() => {
        if (!pairedEntrance) return
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const sync = () => setMotionAllowed(!media.matches)
        sync()
        media.addEventListener('change', sync)
        return () => media.removeEventListener('change', sync)
    }, [pairedEntrance])
    const visible = useInView(pairRef, { once: true, amount: 0.9 })
    const entrance = pairedEntrance ? { enabled: motionAllowed, visible } : undefined
    const captures = (
        <>
            <UsEuAccountCapture
                src={detailsUsd}
                tilt={-3}
                delay={pairedEntrance ? 0 : 0.15}
                entrance={entrance}
                badge="$"
                badgeCorner="bottom-left"
                className="relative -ml-2 w-[97%] md:ml-0 md:w-[84%] lg:w-[54%]"
            />
            <UsEuAccountCapture
                src={detailsEur}
                tilt={2}
                delay={pairedEntrance ? 0.1 : 0.45}
                entrance={entrance}
                badge="€"
                badgeCorner="top-right"
                className={twMerge(
                    'relative z-10 -mt-3 -mr-2 ml-auto w-[97%] md:mr-0 md:w-[84%] lg:mt-16 lg:-ml-16 lg:w-[54%]',
                    pairedEntrance && 'z-auto'
                )}
            />
        </>
    )
    return (
        <UsEuAppLink
            href={STAR_LP_HREF.accountsGuest}
            signedInHref={STAR_LP_HREF.accountsSignedIn}
            surface={surface}
            className={twMerge(
                'mx-auto flex w-full max-w-sm flex-col md:max-w-104 md:pt-8 lg:max-w-224 lg:flex-row lg:items-start lg:pt-4',
                pairedEntrance && 'block lg:block',
                className
            )}
        >
            {pairedEntrance ? (
                <div ref={pairRef} className="relative flex w-full flex-col lg:flex-row lg:items-start">
                    {captures}
                </div>
            ) : (
                captures
            )}
        </UsEuAppLink>
    )
}
