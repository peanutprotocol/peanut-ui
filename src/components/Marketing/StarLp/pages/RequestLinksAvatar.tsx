import { twMerge } from '@/utils/tw'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'
import type { RequestLinksAvatarProps } from './requestLinks.types'

/** The requester's initials avatar, as the app draws a user with no photo. */
export function RequestLinksAvatar({ size = 'small' }: RequestLinksAvatarProps) {
    return (
        <span
            aria-hidden
            className={twMerge(
                'grid shrink-0 place-items-center rounded-full border-2 border-border-default bg-background-brand text-foreground-primary',
                size === 'small' ? 'size-9 text-label-m' : 'size-12 text-body-m-semibold'
            )}
        >
            {REQUEST_LINKS_STORY.initials}
        </span>
    )
}
