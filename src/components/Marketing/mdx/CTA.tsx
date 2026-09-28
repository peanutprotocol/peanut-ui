import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { PROSE_WIDTH } from '../constants'

interface CTAProps {
    text: string
    href: string
    /** subtitle shown below the button in 'card' variant */
    subtitle?: string
    variant?: 'primary' | 'secondary' | 'card'
}

/**
 * MDX call-to-action.
 *
 * - primary: standalone primary button within prose column (default)
 * - secondary: subtle inline text link with arrow — for mid-content CTAs
 * - card: bordered card with button + subtitle — for final/end-of-page CTAs
 *
 * Special: href="#chat" opens Crisp chat via click interceptor (no navigation).
 * The interceptor matches on the anchor's href, so every variant has to render
 * a real anchor — Button link mode and LinkButton both do.
 */
export function CTA({ text, href, subtitle, variant = 'primary' }: CTAProps) {
    // a hash is not a route: keep next/link from treating "#chat" as one
    const plainAnchor = href.startsWith('#')

    if (variant === 'secondary') {
        return (
            <div className={`mx-auto ${PROSE_WIDTH} px-6 py-4 md:px-4`}>
                <LinkButton href={href} icon>
                    {text}
                </LinkButton>
            </div>
        )
    }

    if (variant === 'card') {
        // the mascot hangs 96/112px above the card, so the wrapper reserves that
        // much top room — without it the card lands on the paragraph above
        return (
            <div className={`mx-auto ${PROSE_WIDTH} px-6 pt-24 pb-10 md:px-4 md:pt-28 md:pb-14`}>
                <div className="relative">
                    <PeanutMascot
                        pose="pointing-down"
                        alt="Peanut mascot"
                        className="absolute -top-24 left-1/2 -z-0 h-40 w-40 -translate-x-1/2 md:-top-28 md:h-48 md:w-48"
                    />
                    <Card shadowSize="4" className="relative z-10 items-center gap-4 p-6 text-center md:p-10">
                        <Button
                            href={href}
                            plainAnchor={plainAnchor}
                            shadowSize="4"
                            variant="primary"
                            className="w-full justify-center px-8 sm:w-auto md:px-12"
                        >
                            {text}
                        </Button>
                        {subtitle && <p className="mt-3 text-body-s text-foreground-secondary">{subtitle}</p>}
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className={`mx-auto ${PROSE_WIDTH} px-6 py-8 md:px-4 md:py-12`}>
            <Button
                href={href}
                plainAnchor={plainAnchor}
                shadowSize="4"
                variant="primary"
                className="mx-auto w-full justify-center px-8 sm:w-auto md:px-12"
            >
                {text}
            </Button>
        </div>
    )
}
