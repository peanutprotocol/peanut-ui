import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

/**
 * A country flag over its payment rail's mark, linking to the page that explains
 * the rail.
 *
 * The mark sits directly on the section ground — black is 9:1 on the homepage
 * blue and 19:1 on the /quests cream, so it needs no card (unlike
 * `#regulated-rails`, whose white inner card exists because those marks sit on
 * pink). The fixed-height slot keeps the two marks on a shared baseline; the
 * underlined "Learn more →" is the only click affordance, so it stays.
 */
export function PartnerLockup({
    flag,
    flagAlt,
    logo,
    logoAlt,
    logoClassName,
    href,
    ariaLabel,
    learnMore,
    className,
}: {
    flag: StaticImageData
    flagAlt: string
    logo: StaticImageData
    logoAlt: string
    logoClassName: string
    href: string
    ariaLabel: string
    learnMore: string
    className?: string
}) {
    return (
        <Link
            href={href}
            aria-label={ariaLabel}
            className={twMerge(
                'group flex flex-col items-center transition-transform group-hover:opacity-90 hover:-translate-y-0.5',
                className
            )}
        >
            <Image src={flag} alt={flagAlt} width={177} height={126} className="w-36 md:w-48" />

            <span className="mt-4 flex h-9 items-center justify-center md:mt-5 md:h-13">
                <Image src={logo} alt={logoAlt} width={150} height={38} className={logoClassName} />
            </span>

            <span className="font-roboto-flex mt-3 text-base text-n-1 underline group-hover:no-underline md:text-lg">
                {learnMore} →
            </span>
        </Link>
    )
}
