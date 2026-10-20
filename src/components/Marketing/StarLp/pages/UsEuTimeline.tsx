import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { UsEuBankTransfer } from './UsEuBankTransfer'
import { UsEuMoneyInPush } from './UsEuMoneyInPush'
import { UsEuPixPayment } from './UsEuPixPayment'
import { UsEuTimelineRow } from './UsEuTimelineRow'

/** How it works as three clock times: the client's bank sends, Peanut pings, lunch is paid. Plays once. */
export function UsEuTimeline() {
    return (
        <StorySequence
            stepMs={900}
            className="mx-auto grid w-full max-w-md gap-8"
            beats={[
                <UsEuTimelineRow key="sent" time="12:38">
                    <UsEuBankTransfer />
                    <p className="mt-3 text-heading-card">To their bank, it&apos;s a normal SEPA transfer.</p>
                </UsEuTimelineRow>,
                <UsEuTimelineRow key="in" time="12:39">
                    <UsEuMoneyInPush />
                </UsEuTimelineRow>,
                <UsEuTimelineRow key="lunch" time="12:44">
                    <UsEuPixPayment />
                </UsEuTimelineRow>,
            ]}
        />
    )
}
