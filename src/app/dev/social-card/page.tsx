import Image from 'next/image'
import { notFound } from 'next/navigation'
import Title from '@/components/0_Bruddle/Title'
import { getMascotPlacement } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import { LOGO_LOCKUP } from '@/assets/brand'
import { Star } from '@/assets/illustrations'
import { SocialCardMascot } from './SocialCardMascot'
import { SOCIAL_CARD_DEFAULT, SOCIAL_CARD_SIZE, SOCIAL_CARD_VARIANTS } from './socialCard.consts'
import type { SocialCardVariant } from './socialCard.consts'

/**
 * The page public/metadata-img.png is a screenshot of. The card covers the
 * top-left 1200 x 630 of the window; scripts/render-social-card.mjs opens it
 * at that size and saves the screenshot as it is.
 */
export default async function SocialCardPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
    const { variant: requested = SOCIAL_CARD_DEFAULT } = await searchParams
    if (!Object.hasOwn(SOCIAL_CARD_VARIANTS, requested)) notFound()
    const variant: SocialCardVariant = SOCIAL_CARD_VARIANTS[requested as keyof typeof SOCIAL_CARD_VARIANTS]
    const { art, copy, leadSize, accentSize } = variant

    return (
        <main
            data-social-card={requested}
            className="fixed top-0 left-0 z-50 overflow-hidden bg-background-brand text-foreground-primary"
            style={SOCIAL_CARD_SIZE}
        >
            <div
                className="absolute top-0 flex h-full flex-col items-center justify-center text-center"
                style={{ left: copy.left, width: copy.width }}
            >
                {art.kind === 'logo' && (
                    <Image
                        src={LOGO_LOCKUP}
                        alt="Peanut"
                        style={{ width: art.width, height: 'auto', marginBottom: 40 }}
                    />
                )}
                {variant.phrases.map(({ lead, accent }, i) => (
                    <div
                        key={i}
                        className={variant.rows ? 'flex flex-row items-center' : 'flex flex-col items-center'}
                        style={{ marginTop: i ? (variant.rows ? 24 : 10) : 0 }}
                    >
                        <span
                            className="font-roboto-flex-extrabold relative z-1 font-extraBlack"
                            style={{ fontSize: leadSize, lineHeight: 0.95, letterSpacing: '-0.045em' }}
                        >
                            {lead}
                        </span>
                        {accent && (
                            // A flex box has no line strut, so the Knerd box keeps its own leading.
                            <span
                                className="flex"
                                style={
                                    variant.rows
                                        ? { fontSize: accentSize, marginLeft: 22 }
                                        : { fontSize: accentSize, marginTop: accentSize * 0.24 }
                                }
                            >
                                <Title text={accent} />
                            </span>
                        )}
                    </div>
                ))}
                {variant.subline && (
                    <p
                        style={{
                            marginTop: 28,
                            fontSize: 30,
                            fontWeight: 500,
                            lineHeight: 1.22,
                            letterSpacing: '-0.025em',
                        }}
                    >
                        {variant.subline}
                    </p>
                )}
            </div>
            {art.kind === 'pose' && (
                <div className="absolute" style={art.box}>
                    <div className="absolute" style={getMascotPlacement(art.pose, art.box.width, art.box.height)}>
                        <SocialCardMascot pose={art.pose} frame={art.frame} />
                    </div>
                </div>
            )}
            {variant.stars?.map(({ left, top, width }) => (
                <Image key={`${left}-${top}`} src={Star} alt="" className="absolute" style={{ left, top, width }} />
            ))}
        </main>
    )
}
