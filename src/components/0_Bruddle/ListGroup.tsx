import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement } from 'react'
import { getCardPosition, type CardPosition } from '@/components/Global/Card/card.utils'

// code-only exception: composition recipe with no figma board. assigns
// first/middle/last/single positions to its ListItem/Card children so
// callers stop hardcoding position literals (and getting them wrong when
// an item becomes conditional).

interface ListGroupProps extends HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const ListGroup = ({ children, ...props }: ListGroupProps) => {
    // toArray drops null/false, so conditional items renumber correctly
    const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ position?: CardPosition }>[]
    return (
        <div {...props}>
            {items.map((child, i) =>
                cloneElement(child, { position: child.props.position ?? getCardPosition(i, items.length) })
            )}
        </div>
    )
}

export { ListGroup }
