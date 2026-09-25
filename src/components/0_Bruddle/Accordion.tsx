'use client'

import React, { createContext, useContext } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { twMerge } from '@/utils/tw'
import { type CardPosition } from '../Global/Card/card.utils'
import { Icon } from '../Global/Icons/Icon'

/**
 * Accordion from the figma accordion board (17802:61540), styled over the
 * radix headless base. Items are white cards with the full Card border
 * (one bordered accordion on product surfaces, 2026-09-24); hover
 * tints the item, keyboard focus draws the blue ring, disabled items go
 * gray in fill and text but keep the black border (qa 2026-09-24).
 * Compound API: Accordion > Accordion.Item > Accordion.Trigger +
 * Accordion.Content.
 *
 * `variant="link"` is the in-card toggle (receipt bank details, a second
 * residence): no item border, the trigger is an underlined text link.
 */
type AccordionVariant = 'card' | 'link'

// the variant lives on the root so item, trigger and content read one answer
// and a caller cannot mix a link trigger into a bordered item
const VariantContext = createContext<AccordionVariant>('card')

type AccordionRootProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & {
    variant?: AccordionVariant
}

const AccordionRoot = ({ className, variant = 'card', ...props }: AccordionRootProps) => (
    <VariantContext.Provider value={variant}>
        <AccordionPrimitive.Root className={twMerge('flex flex-col gap-2', className)} {...props} />
    </VariantContext.Provider>
)

// same edges as Global/Card's positions, so an item joins a ListGroup of
// ListItems (ListGroup hands every child its position) as one card
const POSITION_EDGES: Record<CardPosition, string> = {
    solo: 'rounded-sm',
    top: 'rounded-t-sm',
    middle: 'rounded-none border-t-0',
    bottom: 'rounded-none rounded-b-sm border-t-0',
}

type AccordionItemProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & {
    position?: CardPosition
}

const AccordionItem = ({ className, position = 'solo', ...props }: AccordionItemProps) => {
    const variant = useContext(VariantContext)
    return (
        <AccordionPrimitive.Item
            className={twMerge(
                variant === 'card' &&
                    'border border-border-default bg-background-default transition-colors duration-instant hover:bg-background-disabled data-[disabled]:bg-background-disabled data-[disabled]:hover:bg-background-disabled',
                variant === 'card' && POSITION_EDGES[position],
                className
            )}
            {...props}
        />
    )
}

type AccordionTriggerProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    /** ListItem leading slot: one IconBubble, flag or logo (32px) */
    leading?: React.ReactNode
    /** set title to get the ListItem row anatomy instead of the text header */
    title?: React.ReactNode
    body?: React.ReactNode
}

const focusRing = 'focus-visible:outline-[3px] focus-visible:outline-action-focus'

const AccordionTrigger = ({ className, children, leading, title, body, ...props }: AccordionTriggerProps) => {
    const variant = useContext(VariantContext)

    if (variant === 'link') {
        return (
            <AccordionPrimitive.Header className="flex">
                {/* the receipt toggle's shape: a full-width 44px row (py-3 on a
                    20px line), so the link needs no pseudo-element tap target */}
                <AccordionPrimitive.Trigger
                    className={twMerge(
                        'group flex w-full items-center justify-between gap-2 py-3 text-left text-body-s text-foreground-primary underline underline-offset-2',
                        focusRing,
                        className
                    )}
                    {...props}
                >
                    {children}
                    <Icon
                        name="chevron-down"
                        size={16}
                        className="shrink-0 transition-transform duration-moderate group-data-[state=open]:rotate-180"
                    />
                </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
        )
    }

    const chevron = (
        <Icon
            name="chevron-down"
            size={20}
            className="shrink-0 transition-transform duration-moderate group-data-[state=open]:rotate-180"
        />
    )

    if (title !== undefined) {
        return (
            <AccordionPrimitive.Header className="flex">
                {/* class strings copied from ListItem, not ListItem itself: a
                    row component nested in the trigger would put a second
                    button role inside this one */}
                <AccordionPrimitive.Trigger
                    className={twMerge(
                        'group flex w-full items-center justify-between gap-3 p-4 text-left text-foreground-primary data-[disabled]:text-foreground-secondary',
                        focusRing,
                        className
                    )}
                    {...props}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        {leading}
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body-m-semibold break-words">{title}</span>
                            {body && (
                                <span className="text-body-s break-words whitespace-normal text-foreground-secondary">
                                    {body}
                                </span>
                            )}
                        </div>
                    </div>
                    {chevron}
                </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
        )
    }

    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                // text-body-s sits outside twMerge: stock tailwind-merge misreads it as a
                // text-color class and strips it against text-foreground-primary
                className={
                    'text-body-s ' +
                    twMerge(
                        'group flex w-full items-center justify-between gap-2 p-4 text-left text-foreground-primary data-[disabled]:text-foreground-secondary',
                        focusRing,
                        className
                    )
                }
                {...props}
            >
                {children}
                {chevron}
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    )
}

type AccordionContentProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
    /**
     * no padding, for content that brings its own rows (a CountryList,
     * receipt DataRows). In a bordered item the content also widens by 1px
     * each side and below, so the rows' own side and bottom borders land on
     * the item's border and read as one outline, not a card inside a card.
     */
    flush?: boolean
}

const AccordionContent = ({ className, children, flush, forceMount, ...props }: AccordionContentProps) => {
    const variant = useContext(VariantContext)
    return (
        <AccordionPrimitive.Content
            forceMount={forceMount}
            className={twMerge(
                'overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
                flush && variant === 'card' && '-mx-px -mb-px',
                // the Tabs pattern: radix never sets `hidden` on a forceMount
                // panel, so the closed state hides it here. Kept mounted so a
                // country list keeps its search and scroll across a close. The
                // close runs instantly: there is no element left to animate.
                forceMount && 'data-[state=closed]:hidden'
            )}
            {...props}
        >
            {/* text-body-s outside twMerge — see the trigger note. The top rule
                exists only in the bordered item: it is the line between the
                trigger and the first row */}
            <div
                className={
                    'text-body-s ' +
                    twMerge(
                        'text-foreground-primary',
                        variant === 'card' && 'border-t border-border-default',
                        !flush && (variant === 'card' ? 'p-4' : 'pb-3'),
                        className
                    )
                }
            >
                {children}
            </div>
        </AccordionPrimitive.Content>
    )
}

export const Accordion = Object.assign(AccordionRoot, {
    Item: AccordionItem,
    Trigger: AccordionTrigger,
    Content: AccordionContent,
})
