import { REQUEST_LINKS_STORY } from './requestLinks.consts'

/**
 * The requester's initials in the link preview card. A marketing drawing, not
 * the app's avatar (the app draws a letter sticker), but at the app's 32 px
 * card size (TASK-24388).
 */
export function RequestLinksAvatar() {
    return (
        <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-border-default bg-background-brand text-label-m text-foreground-primary"
        >
            {REQUEST_LINKS_STORY.initials}
        </span>
    )
}
