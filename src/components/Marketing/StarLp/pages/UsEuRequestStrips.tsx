import { Icon } from '@/components/Global/Icons/Icon'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { STAR_LP_PERSONA, STAR_LP_REQUEST_LINK_TEXT } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { US_EU_REQUEST_HREF } from './usEuAccounts.consts'
import { fillUsEuLabel } from './usEuAccounts.utils'
import { UsEuAppLink } from './UsEuAppLink'
import { UsEuStrip } from './UsEuStrip'
import type { UsEuRequestStripsLabels, UsEuRequestStripsProps } from './usEuAccounts.types'

const { main, payer } = STAR_LP_PERSONA

/** A second, smaller job paid by someone already on Peanut, so it is not the €1,500 SEPA transfer from How it works. */
const AMOUNT = '$250'

/** /us-europe-accounts' own words. */
const DEFAULT_LABELS: UsEuRequestStripsLabels = {
    ask: 'Where do I pay you?',
    requesting: '{username} is requesting',
    paid: 'Paid',
    chatLabel: 'Chat: {payer} asks where to pay; {main} sends a Peanut request link for {amount}; {payer} paid',
}

const REQUEST_STRIP_CLASS =
    'rotate-[0.7deg] group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant'

/**
 * Tilted, offset strips: the client asks where to pay, the request link
 * lands, the client has paid. They play once in view, 700ms apart
 * (StorySequence). The request strip leads where the fold's CTA leads; the
 * CTA is the keyboard path. Without an `ask` label the story starts at the
 * link (two beats); `linked={false}` drops the link, for a fold with no CTA.
 */
export function UsEuRequestStrips({ labels = DEFAULT_LABELS, linked = true }: UsEuRequestStripsProps = {}) {
    const slots = { main: main.short, payer: payer.short, amount: AMOUNT, username: main.username }
    const requestStrip = (
        <UsEuStrip
            tone="pink"
            initial={main.short[0]}
            who={fillUsEuLabel(labels.requesting, slots)}
            aside={<KnerdTitle text={AMOUNT} size="amount" />}
            className={REQUEST_STRIP_CLASS}
        >
            <span className="block truncate underline decoration-2 underline-offset-4">
                {STAR_LP_REQUEST_LINK_TEXT}
            </span>
        </UsEuStrip>
    )
    const beats = [
        labels.ask ? (
            <UsEuStrip
                key="ask"
                tone="white"
                initial={payer.short[0]}
                who={payer.short}
                className="mr-6 -rotate-[1.2deg] md:mr-8"
            >
                {labels.ask}
            </UsEuStrip>
        ) : null,
        linked ? (
            <UsEuAppLink
                key="link"
                href={US_EU_REQUEST_HREF.guest}
                signedInHref={US_EU_REQUEST_HREF.signedIn}
                className="ml-6 block md:ml-8"
            >
                {requestStrip}
            </UsEuAppLink>
        ) : (
            <div key="link" className="ml-6 md:ml-8">
                {requestStrip}
            </div>
        ),
        <UsEuStrip key="paid" tone="green" initial={payer.short[0]} who={payer.short} className="mr-6 -rotate-[0.5deg]">
            <span className="flex items-center gap-2">
                {labels.paid}
                <span className="star-lp-check-pop inline-flex">
                    <Icon name="check" size={24} />
                </span>
            </span>
        </UsEuStrip>,
    ].filter((beat) => beat !== null)
    return (
        <div
            role="img"
            aria-label={fillUsEuLabel(labels.chatLabel, slots)}
            className="w-full md:max-w-lg md:justify-self-start"
        >
            {/* An img's children are presentational, so the strips (and the link inside) stay out of the
                accessibility tree; the fold's CTA is the keyboard and screen-reader path. */}
            <div aria-hidden>
                <StorySequence className="grid gap-6" beatClassName="group/strip" beats={beats} />
            </div>
        </div>
    )
}
