import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { RequestLinksPaidTick } from './RequestLinksPaidTick'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'
import type { RequestLinksTimelineStop } from './requestLinks.types'

const screen = 'grid gap-1 rounded-card border-2 border-border-default bg-background-default p-3 text-body-s shadow-2'
const screenTitle = 'text-label-l'
const big = 'text-heading-s'
const button = 'mt-1 rounded-full border-2 border-border-default py-1 text-center text-label-m'

const STOPS: RequestLinksTimelineStop[] = [
    {
        time: '10:14',
        screen: (
            <div className={screen}>
                <span className={screenTitle}>Request</span>
                <span className={big}>{REQUEST_LINKS_STORY.amount}</span>
                <span className="text-foreground-secondary">{REQUEST_LINKS_STORY.note}</span>
                <span className={`${button} bg-yellow-500`}>Share {REQUEST_LINKS_STORY.amount} request</span>
            </div>
        ),
    },
    {
        time: '10:15',
        screen: (
            <div className={screen}>
                <span className={screenTitle}>Re: {REQUEST_LINKS_STORY.note}</span>
                <span className="text-foreground-secondary">Thanks! Here you go:</span>
                <span className="text-label-m [overflow-wrap:anywhere] underline">{REQUEST_LINKS_STORY.url}</span>
            </div>
        ),
    },
    {
        time: '17:30',
        screen: (
            <div className={screen}>
                <span className={screenTitle}>Exchange · Send</span>
                <span className={big}>400 USDC</span>
                <span className={`${button} bg-background-brand`}>Confirm</span>
            </div>
        ),
    },
    {
        time: '17:34',
        screen: (
            <div className={screen}>
                <span className={screenTitle}>Activity</span>
                <RequestLinksPaidTick>
                    <span>
                        Payment received
                        <span className="block text-heading-xs">+{REQUEST_LINKS_STORY.amount}</span>
                    </span>
                </RequestLinksPaidTick>
                <span className="text-foreground-secondary">Balance $1,240</span>
            </div>
        ),
    },
]

/** Fold 3: one payment from request to balance, a stop at a time, once. */
export function RequestLinksTimeline() {
    return (
        <div className="relative mx-auto w-full max-w-[420px]">
            <span
                aria-hidden
                className="absolute top-4 bottom-24 left-[9px] border-l-[3px] border-dotted border-border-default"
            />
            <StorySequence
                stepMs={800}
                className="grid gap-6"
                beats={STOPS.map(({ time, screen: stopScreen }) => (
                    <div
                        key={time}
                        className="relative grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-2 pl-8 md:grid-cols-[5rem_minmax(0,1fr)]"
                    >
                        <span className="absolute top-1.5 left-0.5 size-4 rounded-full border-2 border-border-default bg-background-brand" />
                        <span className="text-heading-xs">{time}</span>
                        {stopScreen}
                    </div>
                ))}
            />
        </div>
    )
}
