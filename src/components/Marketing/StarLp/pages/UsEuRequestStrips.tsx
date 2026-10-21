import { Icon } from '@/components/Global/Icons/Icon'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { STAR_LP_PERSONA, STAR_LP_REQUEST_LINK_TEXT } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { US_EU_REQUEST_HREF } from './usEuAccounts.consts'
import { UsEuAppLink } from './UsEuAppLink'
import { UsEuStrip } from './UsEuStrip'

const { main, payer } = STAR_LP_PERSONA

/** A second, smaller job paid by someone already on Peanut, so it is not the €1,500 SEPA transfer from How it works. */
const AMOUNT = '$250'

/**
 * Three tilted, offset strips: the client asks where to pay, the request
 * link lands, the client has paid. They play once in view, 700ms apart
 * (StorySequence). The request strip leads where the fold's CTA leads; the
 * CTA is the keyboard path.
 */
export function UsEuRequestStrips() {
    return (
        <div
            role="img"
            aria-label={`Chat: ${payer.short} asks where to pay; ${main.short} sends a Peanut request link for ${AMOUNT}; ${payer.short} paid`}
            className="w-full md:max-w-lg md:justify-self-end"
        >
            {/* An img's children are presentational, so the strips (and the link inside) stay out of the
                accessibility tree; the fold's CTA is the keyboard and screen-reader path. */}
            <div aria-hidden>
                <StorySequence
                    className="grid gap-6"
                    beatClassName="group/strip"
                    beats={[
                        <UsEuStrip
                            key="ask"
                            tone="white"
                            initial={payer.short[0]}
                            who={payer.short}
                            className="mr-6 -rotate-[1.2deg] md:mr-8"
                        >
                            Where do I pay you?
                        </UsEuStrip>,
                        <UsEuAppLink
                            key="link"
                            href={US_EU_REQUEST_HREF.guest}
                            signedInHref={US_EU_REQUEST_HREF.signedIn}
                            className="ml-6 block md:ml-8"
                        >
                            <UsEuStrip
                                tone="pink"
                                initial={main.short[0]}
                                who={`${main.username} is requesting`}
                                aside={<KnerdTitle text={AMOUNT} size="amount" />}
                                className="rotate-[0.7deg] group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant"
                            >
                                <span className="block truncate underline decoration-2 underline-offset-4">
                                    {STAR_LP_REQUEST_LINK_TEXT}
                                </span>
                            </UsEuStrip>
                        </UsEuAppLink>,
                        <UsEuStrip
                            key="paid"
                            tone="green"
                            initial={payer.short[0]}
                            who={payer.short}
                            className="mr-6 -rotate-[0.5deg]"
                        >
                            <span className="flex items-center gap-2">
                                Paid
                                <span className="star-lp-check-pop inline-flex">
                                    <Icon name="check" size={24} />
                                </span>
                            </span>
                        </UsEuStrip>,
                    ]}
                />
            </div>
        </div>
    )
}
