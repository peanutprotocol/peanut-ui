import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

/**
 * A country flag over its payment rail's mark, linking to the page that explains
 * the rail.
 *
 * The tile is the partner tile from `#regulated-rails` — pink, 1px black border,
 * 4px hard shadow — and the mark keeps the white inner card that fold gives PIX
 * and MercadoPago: both are line art rather than heavy wordmarks, so they go weak
 * straight on the pink.
 */
export function PartnerLockup({
    flag,
    flagAlt,
    logo,
    logoAlt,
    href,
    ariaLabel,
    learnMore,
    className,
}: {
    flag: StaticImageData
    flagAlt: string
    logo: StaticImageData
    logoAlt: string
    href: string
    ariaLabel: string
    learnMore: string
    className?: string
}) {
    return (
        <Link href={href} aria-label={ariaLabel} className={twMerge('group flex flex-col items-center', className)}>
            <Image src={flag} alt={flagAlt} width={180} height={120} className="w-36 md:w-48" />

            <span className="btn btn-purple btn-shadow-primary-4 mt-3 h-20 w-36 justify-center transition-transform group-hover:-translate-y-0.5 group-hover:opacity-90 md:mt-5 md:h-26 md:w-48">
                <Image
                    src={logo}
                    alt={logoAlt}
                    width={101}
                    height={32}
                    className="rounded-sm border border-n-1 bg-white px-3 py-2"
                />
            </span>

            <span className="font-roboto-flex mt-3 text-base text-n-1 underline group-hover:no-underline md:text-lg">
                {learnMore} →
            </span>
        </Link>
    )
}
