'use client'

import { motion, MotionConfig } from 'framer-motion'
import { LOGO } from '@/assets/brand'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { useEntranceArm } from '@/components/Marketing/StarLp/useEntranceArm'
import { CARD_EXAMPLE_SPEND, CARD_LOCK_SCREEN } from './peanutCard.consts'

// The card.spend.authorized push title for a USD spend (peanut-api-ts
// notifications/templates/card.tsx, cardSpendCopy): `${formatMoney(e)} at ${e.merchant}`.
// A USD spend sends no body line on push.
const PUSH_TITLE = `${CARD_EXAMPLE_SPEND.amount} at ${CARD_EXAMPLE_SPEND.merchant}`

const PHONE_VARIANTS = { rest: { y: '0%' }, hidden: { y: '30%' } }
const PUSH_VARIANTS = {
    rest: { opacity: 1, y: 0, scale: 1 },
    hidden: { opacity: 0, y: -24, scale: 0.96 },
}
// Once the push has landed, its icon shakes once (star-lp-push-ding's keyframes).
// Only the armed entrance shakes it; the at-rest render stays still.
const ICON_VARIANTS_ARMED = {
    rest: { rotate: [0, -8, 6, 0], transition: { duration: 0.4, ease: 'easeInOut' as const, delay: 0.85 } },
    hidden: { rotate: 0 },
}
const ICON_VARIANTS_STILL = { rest: { rotate: 0 }, hidden: { rotate: 0 } }

/**
 * The card fold's art: a pink lock screen that rises from the fold floor, then
 * the Peanut push for the spend drops onto it and its icon shakes once. The
 * phone is taller than its box, so the fold floor cuts it. Lock screen and
 * push are drawn OS UI; the icon is the app icon (the brand logo on white).
 * Like PeanutCardRise, it only arms when it starts below the viewport, so the
 * server, a no-JS visitor and reduced motion get the end state.
 */
export function PeanutCardLockScreen() {
    const { ref, armed } = useEntranceArm()
    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                key={armed ? 'armed' : 'rest'}
                ref={ref}
                role="img"
                aria-label={`Phone lock screen at ${CARD_LOCK_SCREEN.clock} with a Peanut notification: ${PUSH_TITLE}`}
                className="mx-auto flex h-[470px] w-full max-w-[300px] justify-center overflow-hidden md:h-[600px] md:max-w-[400px]"
                initial={armed ? 'hidden' : false}
                animate={armed ? undefined : 'rest'}
                whileInView={armed ? 'rest' : undefined}
                viewport={{ once: true, amount: 0.4 }}
            >
                <motion.div
                    variants={PHONE_VARIANTS}
                    transition={STAR_LP_SPRING.drop}
                    className="star-lp-lock-phone h-[620px] w-full shrink-0 bg-gray-950 p-3 md:h-[820px] md:p-4"
                >
                    <div className="star-lp-lock-screen flex h-full flex-col items-center overflow-hidden bg-background-brand px-3 pt-12 text-foreground-primary md:px-4 md:pt-16">
                        <span className="text-heading-card md:text-heading-xs">{CARD_LOCK_SCREEN.date}</span>
                        {/* 80px, the display ramp's step under the fold's headline, so the headline stays the loudest type. */}
                        <span className="font-roboto-flex-extrabold mt-2 text-headingMedium tracking-[-0.03em]">
                            {CARD_LOCK_SCREEN.clock}
                        </span>
                        <motion.div
                            variants={PUSH_VARIANTS}
                            transition={{ ...STAR_LP_SPRING.drop, delay: 0.45 }}
                            className="star-lp-lock-push mt-10 flex w-full items-center gap-3 border-[3px] border-border-default bg-background-default p-3 shadow-4 md:mt-14 lg:gap-4 lg:p-4"
                        >
                            <motion.span
                                variants={armed ? ICON_VARIANTS_ARMED : ICON_VARIANTS_STILL}
                                className="grid size-10 shrink-0 place-items-center rounded-card border-2 border-border-default bg-background-default lg:size-[52px]"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={LOGO.src}
                                    width={LOGO.width}
                                    height={LOGO.height}
                                    alt=""
                                    className="h-[70%] w-auto"
                                />
                            </motion.span>
                            <span className="min-w-0 flex-1 text-left">
                                <span className="flex justify-between text-label-l md:text-body-m-semibold">
                                    <span>Peanut</span>
                                    <span className="font-medium">now</span>
                                </span>
                                {/* iOS sets a push title on one semibold line and truncates it */}
                                <span className="mt-0.5 block truncate text-body-m-semibold lg:text-heading-card">
                                    {PUSH_TITLE}
                                </span>
                            </span>
                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
        </MotionConfig>
    )
}
