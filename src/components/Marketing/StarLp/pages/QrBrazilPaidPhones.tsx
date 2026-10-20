'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { useStoryStep } from '@/components/Marketing/StarLp/useStoryStep'

/* PhoneFrame's look (bezel, hard shadow) with a coloured screen, which
   PhoneFrame's cream/white `screen` prop cannot draw. */
const BEZEL = 'star-lp-phone border-4 border-border-default bg-background-default p-2 shadow-4'
const SCREEN = 'grid min-h-56 md:min-h-64 star-lp-phone-screen px-2 py-4 text-center'

/**
 * Your side and the shop's side of one payment. In view, your Paid screen
 * lands first, then the shop's ordinary "Pix recebido" drops onto its lock
 * screen. A tap shows both at once.
 */
export function QrBrazilPaidPhones() {
    const { ref, step, complete } = useStoryStep(2)
    return (
        <div
            ref={ref}
            onClick={complete}
            role="img"
            aria-label="Two phones: yours shows Paid, R$ 18,00 (USD 3.33); the shop's lock screen shows Pix recebido"
            className="mx-auto grid w-full max-w-[420px] grid-cols-2 gap-4 md:gap-6"
        >
            <div className={BEZEL} style={{ transform: 'rotate(-2deg)' }}>
                <div
                    className={`${SCREEN} place-content-center justify-items-center gap-2 bg-background-badge-success`}
                >
                    <div
                        className="star-lp-beat grid justify-items-center gap-2"
                        data-shown={step > 0}
                        data-story-beat={0}
                    >
                        <IconBubble icon="check" color="green" size="m" className="border-2 border-border-default" />
                        <p className="text-heading-m">Paid</p>
                        <p className="text-body-m-semibold">
                            R$&nbsp;18,00
                            <br />
                            USD 3.33
                        </p>
                    </div>
                </div>
            </div>
            <div className={BEZEL} style={{ transform: 'rotate(2deg)' }}>
                <div className={`${SCREEN} content-start gap-3 bg-gray-950 text-foreground-inverse`}>
                    <p className="text-heading-m">21:47</p>
                    <div
                        lang="pt-BR"
                        className="star-lp-beat rounded-card bg-background-default p-2 text-left text-body-xs text-foreground-primary md:text-body-s"
                        data-shown={step > 1}
                        data-story-beat={1}
                    >
                        <p className="font-bold">Pix recebido</p>
                        <p>
                            Você recebeu <span className="whitespace-nowrap">R$&nbsp;18,00</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
