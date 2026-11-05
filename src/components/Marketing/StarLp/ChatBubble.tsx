import { twMerge } from '@/utils/tw'
import type { ChatBubbleProps } from './starLp.types'

/** One drawn chat message. `me` sits right on the green bubble, `them` left on white. */
export function ChatBubble({ side, author, time, children }: ChatBubbleProps) {
    const mine = side === 'me'
    return (
        // illustrative: hidden from screen readers (the fold heading carries it)
        <div
            aria-hidden
            className={twMerge(
                'max-w-[80%] px-3 py-2 text-body-s text-foreground-primary',
                mine
                    ? 'self-end rounded-card rounded-br-sm bg-background-badge-success'
                    : 'self-start rounded-card rounded-bl-sm bg-background-default'
            )}
        >
            {author && !mine && <span className="block text-label-m text-pink-700">{author}</span>}
            {children}
            {time && <span className="mt-1 block text-right text-body-xs text-foreground-secondary">{time}</span>}
        </div>
    )
}
