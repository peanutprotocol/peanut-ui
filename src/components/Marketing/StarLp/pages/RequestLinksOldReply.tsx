import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { RequestLinksPaidTick } from './RequestLinksPaidTick'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'

const OLD_THREAD = [
    { day: 'Mon', text: 'Send me your account details?', mine: false },
    { day: 'Mon', text: 'Name, number, SWIFT...', mine: true },
    { day: 'Tue', text: 'Which name is on the account?', mine: false },
    { day: 'Wed', text: 'Is it a business account?', mine: true },
    { day: 'Thu', text: 'It bounced.', mine: false },
    { day: 'Fri', text: 'Can you send them again?', mine: true },
] as const

const columnTitle = 'mb-3 text-heading-xs uppercase md:text-heading-s'
const bubble = 'rounded-card border-2 border-border-default px-3 py-2 text-label-m md:text-label-l'
const day = 'block text-body-xs text-foreground-secondary'

/** Fold 1: the five-day bank-details thread beside the same-day link. The link side plays once. */
export function RequestLinksOldReply() {
    return (
        <div className="grid grid-cols-2 gap-3 md:gap-6">
            <div>
                <p className={columnTitle}>5 days</p>
                <div className="grid -rotate-1 gap-2">
                    {OLD_THREAD.map(({ day: d, text, mine }) => (
                        <div key={text} className={`${bubble} bg-background-disabled ${mine ? 'ml-2' : 'mr-2'}`}>
                            <span className={day}>{d}</span>
                            {text}
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <p className={columnTitle}>Same day</p>
                <StorySequence
                    stepMs={900}
                    className="grid gap-2"
                    beats={[
                        <div key="link" className={`${bubble} bg-background-badge-info`}>
                            <span className={day}>Mon 10:15</span>
                            Here you go:
                            <span className="mt-2 block rounded border-2 border-border-default bg-yellow-500 px-2 py-2">
                                <span className="block text-body-m-semibold">{REQUEST_LINKS_STORY.amount}</span>
                                <span className="block text-body-xs">{REQUEST_LINKS_STORY.note}</span>
                            </span>
                        </div>,
                        <RequestLinksPaidTick key="paid" className="text-body-xs md:text-body-s">
                            Payment received
                        </RequestLinksPaidTick>,
                        <div key="glove" className="flex justify-center pt-2">
                            <Wiggle kind="bounce" delay={0.6}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={HandThumbsUp.src}
                                    width={HandThumbsUp.width}
                                    height={HandThumbsUp.height}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    aria-hidden
                                    className="w-16 md:w-20"
                                />
                            </Wiggle>
                        </div>,
                    ]}
                />
            </div>
        </div>
    )
}
