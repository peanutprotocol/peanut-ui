import { twMerge } from '@/utils/tw'
import { KnerdTitle } from './KnerdTitle'
import type { LinkPreviewBubbleProps } from './starLp.types'

/** A chat message carrying a Peanut link preview: pink card, knerd amount, the link under it. */
export function LinkPreviewBubble({ caption, amount, url, side = 'me' }: LinkPreviewBubbleProps) {
    const mine = side === 'me'
    return (
        // illustrative: hidden from screen readers (the fold heading carries it)
        <div
            aria-hidden
            className={twMerge(
                'w-[82%] p-2',
                mine
                    ? 'self-end rounded-card rounded-br-sm bg-background-badge-success'
                    : 'self-start rounded-card rounded-bl-sm bg-background-default'
            )}
        >
            <div className="rounded-card bg-background-brand px-2 pt-3 pb-4 text-center">
                <span className="block text-body-s-semibold">{caption}</span>
                {amount && (
                    <span className="mt-3 block">
                        <KnerdTitle text={amount} size="inline" />
                    </span>
                )}
            </div>
            <span className="block px-1 pt-2 text-body-xs text-foreground-primary underline">{url}</span>
        </div>
    )
}
