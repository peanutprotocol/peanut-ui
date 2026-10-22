import detailsEur from '@/assets/star-lp/us-eu-details-eur.webp'
import detailsUsd from '@/assets/star-lp/us-eu-details-usd.webp'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAccountCapture } from './UsEuAccountCapture'
import { UsEuAppLink } from './UsEuAppLink'

/**
 * Hero art: the app's real USD and EUR bank-details screens (fixtures
 * get-paid-details-usd / -eur, holder set to the page persona, numbers masked),
 * in the headline's order (US, then Europe), landing on top of each other like
 * two stickers; from lg they fan out side by side, USD under US and EUR under
 * Europe, so they grow without stacking taller. On phones each one nearly fills
 * the column and reaches a little into the gutter. The pair leads where the
 * CTA leads: the accounts screen.
 */
export function UsEuAccountPair() {
    return (
        <UsEuAppLink
            href={STAR_LP_HREF.accountsGuest}
            signedInHref={STAR_LP_HREF.accountsSignedIn}
            className="mx-auto flex w-full max-w-sm flex-col md:max-w-104 md:pt-8 lg:max-w-224 lg:flex-row lg:items-start lg:pt-4"
        >
            <UsEuAccountCapture
                src={detailsUsd}
                tilt={-3}
                delay={0.15}
                badge="$"
                badgeCorner="bottom-left"
                className="relative -ml-2 w-[97%] md:ml-0 md:w-[84%] lg:w-[54%]"
            />
            <UsEuAccountCapture
                src={detailsEur}
                tilt={2}
                delay={0.45}
                badge="€"
                badgeCorner="top-right"
                className="relative z-10 -mt-3 -mr-2 ml-auto w-[97%] md:mr-0 md:w-[84%] lg:mt-16 lg:-ml-16 lg:w-[54%]"
            />
        </UsEuAppLink>
    )
}
