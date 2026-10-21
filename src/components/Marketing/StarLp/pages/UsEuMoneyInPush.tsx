import Logo from '@/assets/brand/logo.svg'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAppLink } from './UsEuAppLink'
import { US_EU_EUR_IN } from './usEuAccounts.consts'
import type { UsEuFxProps } from './usEuAccounts.types'
import { usEuMoneyInBody } from './usEuAccounts.utils'

/**
 * The Peanut push when the euros land, as the app sends it for a completed
 * bank deposit: "Money in!" and the dollars credited (usEuMoneyInBody). The
 * body needs the live EUR→USD rate; without one the push shows its title
 * only, never a euro amount, because the balance is in dollars. It drops in
 * like an OS notification (star-lp-push-drop) and, like one, a tap opens the
 * app: the accounts screen the CTAs lead to.
 */
export function UsEuMoneyInPush({ eurUsd }: UsEuFxProps) {
    const body = usEuMoneyInBody(US_EU_EUR_IN, eurUsd)
    return (
        <UsEuAppLink
            href={STAR_LP_HREF.accountsGuest}
            signedInHref={STAR_LP_HREF.accountsSignedIn}
            className="star-lp-own-entrance star-lp-push-drop block"
        >
            <div
                role="img"
                aria-label={body ? `Peanut notification: Money in! ${body}` : 'Peanut notification: Money in!'}
                className="flex items-center gap-3 rounded-card border-2 border-border-default bg-background-default p-3 shadow-4 group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant"
            >
                <span className="star-lp-push-ding grid h-10 w-10 shrink-0 place-items-center rounded-card border-2 border-border-default bg-background-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={Logo.src}
                        width={Logo.width}
                        height={Logo.height}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="h-6 w-6"
                    />
                </span>
                <span>
                    <span className="block text-heading-s">Money in!</span>
                    {body && <span className="block text-body-m">{body}</span>}
                </span>
            </div>
        </UsEuAppLink>
    )
}
