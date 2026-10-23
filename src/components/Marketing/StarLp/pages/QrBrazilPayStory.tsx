'use client'

import { useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { QrBrazilAppLink } from './QrBrazilAppLink'
import { QrBrazilPayCapture } from './QrBrazilPayCapture'
import { QR_BRAZIL_AMOUNT_BRL } from './qrBrazil.consts'
import { qrBrazilUsdFor } from './qrBrazil.utils'
import type { QrBrazilPayStoryProps } from './qrBrazil.types'

/* PhoneFrame's look (bezel, hard shadow) around a capture or a coloured
   screen, which PhoneFrame's cream/white `screen` prop cannot draw. */
const BEZEL = 'star-lp-phone border-4 border-border-default bg-background-default p-2 shadow-4'
const BRL = `R$ ${QR_BRAZIL_AMOUNT_BRL},00`
/** One beat: your Pay screen and the shop's phone, then the Pay tap, then the push. */
const STEP_MS = 800
const SHOP_HIDDEN = { x: 24, rotate: 6, opacity: 0 }
const SHOP_SHOWN = { x: 0, rotate: 3, opacity: 1 }
const SHOP_BUZZ = { x: 0, rotate: [3, -3, 5, -1, 3], opacity: 1 }

/**
 * One payment, both sides, played once in view: your phone (the app's real
 * Pay screen at the live rate), the shop's phone slides in, Pay is tapped,
 * and the shop's lock screen gets an ordinary "Pix recebido" that drops in
 * from the top and buzzes the phone as it lands. A tap on your phone opens
 * signup; a tap anywhere else on the story shows the rest at once.
 */
export function QrBrazilPayStory({ usdBrl }: QrBrazilPayStoryProps) {
    const { ref, step, complete } = useStoryStep(3, STEP_MS)
    const [landed, setLanded] = useState(false)
    const usd = usdBrl ? `, about USD ${qrBrazilUsdFor(QR_BRAZIL_AMOUNT_BRL, usdBrl.rate)}` : ''
    const shown = step > 0
    const pushed = step > 2
    const shopTarget = !shown ? SHOP_HIDDEN : pushed && landed ? SHOP_BUZZ : SHOP_SHOWN
    return (
        <MotionConfig reducedMotion="user">
            <div ref={ref} className="relative mx-auto w-full max-w-[420px]" onClick={complete}>
                <div
                    className="star-lp-beat w-[80%] md:w-[74%]"
                    data-shown={shown}
                    data-story-beat={0}
                    style={{ rotate: '-2deg' }}
                >
                    <QrBrazilAppLink
                        label={`Create an account. Peanut's Pay screen: ${BRL} to Padaria da Esquina${usd}, no Peanut fee.`}
                    >
                        <span className={`${BEZEL} block transition-shadow duration-instant group-active:shadow-none`}>
                            <span className="star-lp-phone-screen block overflow-hidden bg-background-page">
                                <QrBrazilPayCapture usdBrl={usdBrl} pressed={step > 1} />
                            </span>
                        </span>
                    </QrBrazilAppLink>
                </div>
                <motion.div
                    role="img"
                    aria-label={`The shop's lock screen: Pix recebido, ${BRL}`}
                    className="absolute top-[30%] right-0 w-[44%] md:top-[44%] md:right-4 md:w-[40%] xl:right-[-8%]"
                    initial={false}
                    animate={shopTarget}
                    transition={
                        shopTarget === SHOP_BUZZ
                            ? { duration: 0.5 }
                            : shown
                              ? { ...STAR_LP_SPRING.drop, delay: 0.45 }
                              : { duration: 0 }
                    }
                >
                    <div className={BEZEL}>
                        <div className="star-lp-phone-screen grid min-h-56 content-start gap-3 bg-gray-950 px-2 py-4 text-center text-foreground-inverse md:min-h-64">
                            <p className="text-heading-m">21:47</p>
                            <motion.div
                                lang="pt-BR"
                                className="rounded-card bg-background-default p-2 text-left text-body-xs text-foreground-primary md:text-body-s"
                                data-story-beat={2}
                                initial={false}
                                animate={pushed ? { y: 0, opacity: 1 } : { y: -14, opacity: 0 }}
                                transition={pushed ? STAR_LP_SPRING.drop : { duration: 0 }}
                                onAnimationComplete={() => setLanded(pushed)}
                            >
                                <p className="font-bold">Pix recebido</p>
                                <p>
                                    Você recebeu <span className="whitespace-nowrap">{BRL}</span>
                                </p>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </MotionConfig>
    )
}
