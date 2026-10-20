import { Icon } from '@/components/Global/Icons/Icon'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { RequestLinksAvatar } from './RequestLinksAvatar'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'

const METHODS = [
    { title: 'Peanut', detail: 'Pay from your balance · instant', ground: 'bg-background-brand' },
    { title: 'Exchange or wallet', detail: 'Send to the address shown · minutes', ground: 'bg-background-default' },
] as const

/** Fold 2: the request page the client opens. Bank payers stay off it (request-links.md). */
export function RequestLinksPayScreen() {
    return (
        <PhoneFrame
            screen="white"
            className="max-w-[340px]"
            label={`Request page: ${REQUEST_LINKS_STORY.requester} is requesting ${REQUEST_LINKS_STORY.amount}; pay with Peanut or from an exchange or wallet`}
        >
            <div className="flex flex-col items-center gap-1 pt-3 text-body-s text-foreground-secondary">
                <RequestLinksAvatar size="large" />
                {REQUEST_LINKS_STORY.requester} is requesting
            </div>
            <p className="text-center text-heading-xl">{REQUEST_LINKS_STORY.amount}</p>
            <p className="rounded border-2 border-border-default bg-background-page px-2 py-2 text-center text-label-l">
                &ldquo;{REQUEST_LINKS_STORY.note}&rdquo;
            </p>
            <p className="mt-2 text-label-l">How do you want to pay?</p>
            {METHODS.map(({ title, detail, ground }) => (
                <div
                    key={title}
                    className={`shadow-2 flex items-center justify-between gap-2 rounded-card border-2 border-border-default px-3 py-2 ${ground}`}
                >
                    <span>
                        <span className="block text-label-l">{title}</span>
                        <span className="block text-body-xs">{detail}</span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                </div>
            ))}
            <span className="h-2" />
        </PhoneFrame>
    )
}
