'use client'

import { animate } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef } from 'react'
import payCapture from '@/assets/star-lp/request-links-pay.webp'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { RequestLinksAppLink } from './RequestLinksAppLink'
import { REQUEST_LINKS_CLIENT_SEES_EVENT, REQUEST_LINKS_STORY } from './requestLinks.consts'

/**
 * Fold 2: the real request page the client opens (fixture request-pay-open-amount,
 * captured with the persona's name and the story's amount, balance row taken out
 * because a signed-out client sees none). The whole screen is one link to signup.
 * When a link card scrolls the visitor here, the phone pops again.
 */
export function RequestLinksPayScreen() {
    const phone = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const pop = () => {
            if (!phone.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            animate(phone.current, { scale: [0.94, 1], rotate: [-3, 0] }, STAR_LP_SPRING.pop)
        }
        window.addEventListener(REQUEST_LINKS_CLIENT_SEES_EVENT, pop)
        return () => window.removeEventListener(REQUEST_LINKS_CLIENT_SEES_EVENT, pop)
    }, [])

    return (
        <div ref={phone}>
            <RequestLinksAppLink sink="md" className="mx-auto w-full max-w-[340px]">
                <PhoneFrame
                    className="rl-lift max-w-[340px] [&>.star-lp-phone-screen]:p-0"
                    label={`Request page: ${REQUEST_LINKS_STORY.username} is requesting ${REQUEST_LINKS_STORY.amount}. Pay with Peanut, a bank transfer or crypto.`}
                >
                    <Image src={payCapture} alt="" sizes="330px" className="h-auto w-full" />
                </PhoneFrame>
            </RequestLinksAppLink>
        </div>
    )
}
