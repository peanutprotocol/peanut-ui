import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'

interface ContentLinkRowProps {
    href: string
    title: string
    description?: string
    /** Position in the group — the row draws its own top/middle/bottom corners. */
    index: number
    total: number
    /** Language of the title and description when it is not the page's (an English fallback). */
    lang?: string
    /** Visible note that the item is in another language, e.g. "En inglés". */
    languageLabel?: string
}

/**
 * One row of a marketing index: the content hub, the help hub and the stories
 * list all render this.
 *
 * The row is an anchor, not an onClick handler: these lists are the crawlable
 * half of each hub, so ListItem sits inside a Link — which is also why
 * ListGroup, whose cloneElement would put `position` on the anchor, cannot own
 * the grouping here.
 */
export function ContentLinkRow({ href, title, description, index, total, lang, languageLabel }: ContentLinkRowProps) {
    const heading = (
        <h3 lang={lang} className="truncate group-hover:underline">
            {title}
        </h3>
    )
    return (
        <Link
            href={href}
            hrefLang={lang}
            className="group block rounded-sm focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
        >
            <ListItem
                position={getCardPosition(index, total)}
                title={
                    languageLabel ? (
                        <div className="flex min-w-0 items-baseline gap-2">
                            {heading}
                            <span className="shrink-0 text-label-m text-foreground-secondary">{languageLabel}</span>
                        </div>
                    ) : (
                        heading
                    )
                }
                body={
                    lang && description ? (
                        <span lang={lang} className="block truncate">
                            {description}
                        </span>
                    ) : (
                        description
                    )
                }
                trailing={<Icon name="arrow-up-right" size={20} className="text-foreground-secondary" />}
                className="transition-colors duration-instant group-hover:bg-background-disabled"
            />
        </Link>
    )
}
