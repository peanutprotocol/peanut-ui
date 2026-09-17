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
export function ContentLinkRow({ href, title, description, index, total }: ContentLinkRowProps) {
    return (
        <Link
            href={href}
            className="group block rounded-sm focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
        >
            <ListItem
                position={getCardPosition(index, total)}
                title={<h3 className="truncate group-hover:underline">{title}</h3>}
                body={description}
                trailing={<Icon name="arrow-up-right" size={20} className="text-foreground-secondary" />}
                className="transition-colors duration-instant group-hover:bg-background-disabled"
            />
        </Link>
    )
}
