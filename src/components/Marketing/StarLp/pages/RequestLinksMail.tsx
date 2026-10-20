import { RequestLinksLinkCard } from './RequestLinksLinkCard'
import { REQUEST_LINKS_CLIENT_SEES_ID, REQUEST_LINKS_STORY } from './requestLinks.consts'

const typingDot = 'size-1.5 rounded-full bg-foreground-primary'

/**
 * Hero art: the email thread where the client asks and the link answers. On load
 * (CSS only, so it runs before hydration) three dots type, then the link card
 * lands; reduced motion paints the card at rest. A tap on the card scrolls to
 * what the client sees.
 */
export function RequestLinksMail() {
    return (
        <div className="shadow-primary-6 mx-auto w-full max-w-[420px] -rotate-1 overflow-hidden rounded-card border-2 border-border-default bg-background-default text-left">
            <div className="flex items-center gap-2 border-b-2 border-border-default bg-background-page px-3 py-2 text-label-m">
                <span className="size-2.5 rounded-full border-2 border-border-default bg-background-default" />
                <span className="size-2.5 rounded-full border-2 border-border-default bg-background-default" />
                <span className="size-2.5 rounded-full border-2 border-border-default bg-background-default" />
                <span className="ml-2 truncate">Re: {REQUEST_LINKS_STORY.note}</span>
            </div>
            <div className="border-b-2 border-dashed border-border-subtle px-4 py-3">
                <p className="flex justify-between text-label-m">
                    {REQUEST_LINKS_STORY.payer}
                    <span className="text-body-xs text-foreground-secondary">10:02</span>
                </p>
                <p className="mt-1 text-body-s">Logo looks great! How do I pay you?</p>
            </div>
            <div className="bg-background-badge-info px-4 pt-3 pb-4">
                <p className="flex justify-between text-label-m">
                    You
                    <span className="text-body-xs text-foreground-secondary">10:15</span>
                </p>
                <p className="mt-1 text-body-s">Thanks! Here you go:</p>
                <div className="relative mt-2">
                    <span
                        aria-hidden
                        className="rl-typing absolute top-0 left-0 items-center gap-1 rounded-card border-2 border-border-default bg-background-default px-3 py-2.5"
                    >
                        <span className={typingDot} />
                        <span className={typingDot} />
                        <span className={typingDot} />
                    </span>
                    <div className="rl-card-land">
                        <RequestLinksLinkCard to={REQUEST_LINKS_CLIENT_SEES_ID} />
                    </div>
                </div>
            </div>
        </div>
    )
}
