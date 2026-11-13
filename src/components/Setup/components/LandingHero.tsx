'use client'

import { type ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { LOGO } from '@/assets/brand'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import coinEur from '@/assets/illustrations/coin-eur.webp'
import coinUsd from '@/assets/illustrations/coin-usd.webp'
import Card from '@/components/Global/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { twMerge } from '@/utils/tw'

// Fast rubber-hose pop: overshoot and settle in about 300 ms (Konrad, 2026-10-25: no calm loops).
const POP = { type: 'spring', stiffness: 520, damping: 13, mass: 0.6 } as const
// Where the sample payment comes from: the two currencies of the bank details.
const SOURCE_CHIPS = [
    { code: 'USD', coin: coinUsd, rotate: -6, delay: 0.3, className: 'top-1/2 left-0' },
    { code: 'EUR', coin: coinEur, rotate: 5, delay: 0.38, className: 'top-2/3 right-0' },
] as const

const BOB = { duration: 0.5, ease: 'easeOut', repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.7 } as const

/** A sticker that pops in on mount and then bobs on the beat; reduced motion shows the resting frame. */
function Pop({
    children,
    className,
    delay = 0,
    rotate = 0,
    bob = 0,
    still,
}: {
    children: ReactNode
    className?: string
    delay?: number
    rotate?: number
    bob?: number
    still: boolean
}) {
    if (still) {
        return (
            <motion.div className={className} initial={false} animate={{ rotate }}>
                {children}
            </motion.div>
        )
    }
    return (
        <motion.div
            className={className}
            initial={{ scale: 0.3, rotate: rotate + 12, opacity: 0 }}
            animate={{ scale: 1, rotate, opacity: 1 }}
            transition={{ ...POP, delay }}
        >
            {bob ? (
                <motion.div animate={{ y: [0, -bob] }} transition={{ ...BOB, delay: delay + 0.4 }}>
                    {children}
                </motion.div>
            ) : (
                children
            )}
        </motion.div>
    )
}

/**
 * The Welcome hero (first-screen concept A2, Konrad 2026-11-13): the headline on the blue
 * stage, and the peanut cheering under a sample "money received" card with its USD and EUR
 * sources. The card floats above the mascot's whole jump, so it never covers the face.
 * Decorative apart from the headline, which is the screen's h1.
 */
export default function LandingHero({ title, still }: { title?: ReactNode; still: boolean }) {
    const t = useTranslations('setup.landing.hero')
    return (
        <div className="absolute inset-0 flex flex-col px-6 pt-16 pb-2 md:px-10 md:pt-16 md:pb-10 tight:pt-14">
            {title && (
                <h1 className="max-w-xs text-left text-heading-l md:max-w-md short:text-heading-m tight:text-heading-s">
                    {title}
                </h1>
            )}
            <div aria-hidden="true" className="relative mx-auto mt-3 min-h-0 w-full max-w-sm flex-1 md:max-w-md">
                <div className="absolute inset-x-0 top-20 bottom-0 tight:top-14">
                    <PeanutMascot pose="cheering" className="relative h-full w-full" />
                </div>

                <Pop
                    still={still}
                    delay={0.1}
                    rotate={-4}
                    bob={4}
                    className="absolute top-1 left-1/2 z-10 w-64 -translate-x-1/2 tight:w-56"
                >
                    <Card className="relative flex items-center gap-3 p-3 shadow-4 tight:p-2">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border-default bg-background-accent-yellow tight:size-8">
                            <Image src={LOGO} alt="" className="h-7 w-auto tight:h-6" />
                        </span>
                        <span className="min-w-0 text-left">
                            <span className="block text-label-l">{t('received')}</span>
                            <span className="block text-heading-xs">{t('amount')}</span>
                        </span>
                        <span className="absolute -top-3 left-3 rounded-full border border-border-default bg-background-default px-2 text-label-m">
                            {t('example')}
                        </span>
                    </Card>
                </Pop>

                {SOURCE_CHIPS.map((chip) => (
                    <Pop
                        key={chip.code}
                        still={still}
                        delay={chip.delay}
                        rotate={chip.rotate}
                        className={twMerge('absolute z-10', chip.className)}
                    >
                        <Card className="shadow-2 flex w-auto items-center gap-2 py-1 pr-3 pl-1 text-label-l">
                            <Image src={chip.coin} alt="" className="h-6 w-auto" />
                            {chip.code}
                        </Card>
                    </Pop>
                ))}

                <Pop still={still} delay={0.45} className="absolute top-0 left-2 z-10 w-5">
                    <Image src={star} alt="" className="h-auto w-full" />
                </Pop>
                <Pop still={still} delay={0.5} className="absolute top-14 right-1 z-10 w-7 tight:top-10">
                    <Image src={star} alt="" className="h-auto w-full" />
                </Pop>
                <Pop still={still} delay={0.55} rotate={-20} className="absolute -top-3 right-8 z-10 w-8">
                    <Image src={sparkle} alt="" className="h-auto w-full" />
                </Pop>
            </div>
        </div>
    )
}
