import { notFound } from 'next/navigation'
import Title from '@/components/0_Bruddle/Title'
import { getMascotPlacement } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import { SocialCardMascot } from './SocialCardMascot'
import { SOCIAL_CARD_DEFAULT, SOCIAL_CARD_SIZE, SOCIAL_CARD_VARIANTS } from './socialCard.consts'

/**
 * The page public/metadata-img.png is a screenshot of. The card covers the
 * top-left 1200 x 630 of the window; scripts/render-social-card.mjs opens it
 * at that size and saves the screenshot as it is.
 */
export default async function SocialCardPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
    const { variant: requested = SOCIAL_CARD_DEFAULT } = await searchParams
    if (!Object.hasOwn(SOCIAL_CARD_VARIANTS, requested)) notFound()
    const variant = SOCIAL_CARD_VARIANTS[requested as keyof typeof SOCIAL_CARD_VARIANTS]
    const { box } = variant
    const canvas = getMascotPlacement('walking', box.width, box.height)

    return (
        <main
            data-social-card={requested}
            className="bg-background-brand text-foreground-primary fixed left-0 top-0 z-50 overflow-hidden"
            style={SOCIAL_CARD_SIZE}
        >
            <div className="absolute flex flex-col items-start" style={{ left: 92, top: 196 }}>
                <span className="font-roboto-flex-extrabold uppercase" style={{ fontSize: 68, marginLeft: 6 }}>
                    Buttery smooth
                </span>
                <span style={{ fontSize: 205, marginTop: 34 }}>
                    <Title text={'GLOBAL\nMONEY'} />
                </span>
            </div>
            <div className="absolute" style={box}>
                <div
                    className="absolute"
                    style={{ left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height }}
                >
                    <SocialCardMascot frame={variant.frame} />
                </div>
            </div>
        </main>
    )
}
