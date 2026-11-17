'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import peanutLogo from '@/assets/brand/logo.svg'

const SQUASH = [0.5, 0, 0.5, 1] as const

/**
 * The "Money received!" card on the landing hero: a UI object, not art. Sizes are the art box's design px (the card
 * scales with the hero), so its type is set in px from the mock rather than from the app's type scale.
 * It stamps in once (scale 1.4 to 1 with a 4 % squash, 340 ms after 700 ms); reduced motion shows it at rest.
 */
export function MoneyCard({ animate }: { animate: boolean }) {
    const t = useTranslations('setupRedesign.landing')
    return (
        <motion.div
            className="flex h-full w-full items-center gap-3 rounded border-2 border-border-default bg-background-default px-3 shadow-4"
            initial={animate ? { opacity: 0, scaleX: 1.4, scaleY: 1.4 } : false}
            animate={{ opacity: [0, 1, 1, 1], scaleX: [1.4, 1, 1.03, 1], scaleY: [1.4, 1, 0.96, 1] }}
            transition={{
                duration: 0.34,
                delay: 0.7,
                times: [0, 0.6, 0.8, 1],
                ease: [[0.55, 0, 1, 0.45], SQUASH, SQUASH],
            }}
            data-testid="landing-money-card"
        >
            <span className="flex size-9 flex-none items-center justify-center rounded border border-border-default bg-background-accent-yellow">
                <Image src={peanutLogo} alt="" className="h-[22px] w-auto" />
            </span>
            <span className="min-w-0 text-foreground-primary">
                <span className="block whitespace-nowrap" style={{ fontSize: 15, lineHeight: '19px', fontWeight: 800 }}>
                    {t('cardReceived')}
                </span>
                <span className="block whitespace-nowrap" style={{ fontSize: 20, lineHeight: '24px', fontWeight: 900 }}>
                    {t('cardAmount')}
                </span>
            </span>
        </motion.div>
    )
}
