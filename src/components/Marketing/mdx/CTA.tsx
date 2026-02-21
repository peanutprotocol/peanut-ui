import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { PeanutGuyGIF } from '@/assets'
import { PROSE_WIDTH } from './constants'

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
 * - primary: standalone purple button within prose column (default)
 * - secondary: subtle inline text link with arrow — for mid-content CTAs
 * - card: bordered card with button + subtitle — for final/end-of-page CTAs
 */
export function CTA({ text, href, subtitle, variant = 'primary' }: CTAProps) {
    if (variant === 'secondary') {
        return (
            <div className={`mx-auto ${PROSE_WIDTH} px-6 py-4 md:px-4`}>
                <Link
                    href={href}
                    className="inline-flex items-center gap-1 font-semibold text-n-1 underline decoration-n-1/30 underline-offset-2 hover:decoration-n-1"
                >
                    {text} <span aria-hidden="true">&rarr;</span>
                </Link>
            </div>
        )
    }

    if (variant === 'card') {
        return (
            <div className={`mx-auto ${PROSE_WIDTH} px-6 py-10 md:px-4 md:py-14`}>
                <div className="relative">
                    <Image
                        src={PeanutGuyGIF}
                        alt="Peanut mascot"
                        width={200}
                        height={200}
                        className="absolute -top-24 left-1/2 -z-0 h-40 w-40 -translate-x-1/2 md:-top-28 md:h-48 md:w-48"
                        unoptimized
                    />
                    <Card shadowSize="4" className="relative z-10 items-center gap-4 p-6 text-center md:p-10">
                        <a href={href}>
                            <Button
                                shadowSize="4"
                                variant="purple"
                                className="w-full px-8 text-base font-bold sm:w-auto md:px-12 md:text-lg"
                            >
                                {text}
                            </Button>
                        </a>
                        {subtitle && (
                            <p className="mt-3 text-sm text-grey-1">{subtitle}</p>
                        )}
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className={`mx-auto ${PROSE_WIDTH} px-6 py-8 text-center md:px-4 md:py-12`}>
            <a href={href}>
                <Button
                    shadowSize="4"
                    variant="purple"
                    className="w-full px-8 text-base font-bold sm:w-auto md:px-12 md:text-lg"
                >
                    {text}
                </Button>
            </a>
        </div>
    )
}
