import Logo from '@/assets/brand/logo.svg'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAppLink } from './UsEuAppLink'
import type { UsEuFxProps } from './usEuAccounts.types'

const EUR_IN = 1500

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const eur = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' })

/**
 * The Peanut push a minute later. It states the euros received. With a live
 * EUR→USD rate it adds the dollar value as an estimate: /fx/rate is an
 * indicative display rate and Bridge settles at its own quoted rate
 * (product/pricing.md), so the figure is never shown as the credited amount.
 * Without a rate there is no USD figure at all. It drops in like an
 * OS notification (star-lp-push-drop) and, like one, a tap opens the app: the
 * accounts screen the CTAs lead to.
 */
export function UsEuMoneyInPush({ eurUsd }: UsEuFxProps) {
    const eurText = eur.format(EUR_IN)
    const usdText = eurUsd ? usd.format(Math.floor(EUR_IN * eurUsd.rate * 100) / 100) : null
    return (
        <UsEuAppLink
            href={STAR_LP_HREF.accountsGuest}
            signedInHref={STAR_LP_HREF.accountsSignedIn}
            className="star-lp-own-entrance star-lp-push-drop block"
        >
            <div
                role="img"
                aria-label={
                    usdText
                        ? `Peanut notification: ${eurText} received, about ${usdText} at today's rate`
                        : `Peanut notification: ${eurText} received`
                }
                className="flex items-center gap-3 rounded-card border-2 border-border-default bg-background-default p-3 shadow-4 group-active:translate-x-[3px] group-active:translate-y-[3px] group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant"
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
                    <span className="block text-heading-s">{eurText} received</span>
                    {usdText && (
                        <span className="block text-body-s text-foreground-secondary">
                            ≈ {usdText} at today&apos;s rate
                        </span>
                    )}
                </span>
            </div>
        </UsEuAppLink>
    )
}
