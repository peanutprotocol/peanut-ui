import Image from 'next/image'
import Title from '@/components/0_Bruddle/Title'
import LOGO_LOCKUP from '@/assets/brand/logo-lockup.svg'

// Copy from mono content/_system/context/messaging.md (tagline and homepage
// subline), split into a Roboto Flex lead and a Knerd accent the way the
// homepage hero sets them side by side from 768 px.
const TAGLINE = [
    { lead: 'Get paid', accent: 'GLOBALLY' },
    { lead: 'Spend', accent: 'LOCALLY' },
] as const
const SUBLINE = 'Receive dollars and euros. Pay by card or QR.'

/**
 * The page public/metadata-img.png is a screenshot of. The card covers the
 * top-left 1200 x 630 of the window; scripts/render-social-card.mjs opens it
 * at that size and saves the screenshot as it is. It only places the approved
 * logo lockup next to type; nothing is drawn here.
 */
export default function SocialCardPage() {
    return (
        <main
            data-social-card
            className="fixed top-0 left-0 z-50 overflow-hidden bg-background-brand text-foreground-primary"
            style={{ width: 1200, height: 630 }}
        >
            <div
                className="absolute top-0 flex h-full flex-col items-center justify-center text-center"
                style={{ left: 60, width: 1080 }}
            >
                <Image src={LOGO_LOCKUP} alt="Peanut" style={{ width: 360, height: 'auto', marginBottom: 40 }} />
                {TAGLINE.map(({ lead, accent }, i) => (
                    <div key={lead} className="flex flex-row items-center" style={{ marginTop: i ? 24 : 0 }}>
                        <span
                            className="font-roboto-flex-extrabold relative z-1 font-extraBlack"
                            style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.045em' }}
                        >
                            {lead}
                        </span>
                        {/* A flex box has no line strut, so the Knerd box keeps its own leading. */}
                        <span className="flex" style={{ fontSize: 120, marginLeft: 22 }}>
                            <Title text={accent} />
                        </span>
                    </div>
                ))}
                <p
                    style={{
                        marginTop: 28,
                        fontSize: 30,
                        fontWeight: 500,
                        lineHeight: 1.22,
                        letterSpacing: '-0.025em',
                    }}
                >
                    {SUBLINE}
                </p>
            </div>
        </main>
    )
}
