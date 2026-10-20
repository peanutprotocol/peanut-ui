import { twMerge } from '@/utils/tw'
import { RequestLinksAppLink } from './RequestLinksAppLink'
import { RequestLinksAvatar } from './RequestLinksAvatar'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'
import type { RequestLinksLinkCardProps } from './requestLinks.types'

/**
 * The request link as it lands in a message: yellow preview card, amount, note, the link.
 * A tap opens signup, or with `to` scrolls to that fold.
 */
export function RequestLinksLinkCard({ tilt = 0, className, to }: RequestLinksLinkCardProps) {
    return (
        <RequestLinksAppLink to={to}>
            <span
                className={twMerge(
                    'rl-lift shadow-2 flex items-center gap-3 rounded-card border-2 border-border-default bg-yellow-500 p-3 text-left',
                    className
                )}
                style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
            >
                <RequestLinksAvatar />
                <span className="min-w-0">
                    <span className="block text-heading-xs">{REQUEST_LINKS_STORY.amount}</span>
                    <span className="block text-body-xs">{REQUEST_LINKS_STORY.note}</span>
                    <span className="block truncate text-label-m underline">{REQUEST_LINKS_STORY.url}</span>
                </span>
            </span>
        </RequestLinksAppLink>
    )
}
