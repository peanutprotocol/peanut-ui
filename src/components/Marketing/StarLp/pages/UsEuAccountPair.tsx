import detailsEur from '@/assets/star-lp/us-eu-details-eur.webp'
import detailsUsd from '@/assets/star-lp/us-eu-details-usd.webp'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAccountCapture } from './UsEuAccountCapture'
import { UsEuAppLink } from './UsEuAppLink'

/**
 * Hero art: the app's real EUR and USD bank-details screens (fixtures
 * get-paid-details-eur / -usd, holder set to the page persona, numbers masked),
 * landing on top of each other like two stickers. The pair leads where the CTA leads: the accounts screen.
 */
export function UsEuAccountPair() {
    return (
        <UsEuAppLink
            href={STAR_LP_HREF.accountsGuest}
            signedInHref={STAR_LP_HREF.accountsSignedIn}
            className="mx-auto flex w-full max-w-sm flex-col"
        >
            <UsEuAccountCapture src={detailsEur} tilt={-3} delay={0.15} className="relative w-[84%]" />
            <UsEuAccountCapture
                src={detailsUsd}
                tilt={2}
                delay={0.45}
                className="relative z-10 -mt-3 ml-auto w-[84%]"
            />
        </UsEuAppLink>
    )
}
