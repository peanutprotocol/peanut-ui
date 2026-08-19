'use client'

import React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'

/**
 * Accordion from the figma accordion board (17802:61540), styled over the
 * radix headless base. Items are white cards with a bottom border; hover
 * tints the item, keyboard focus draws the blue ring, disabled items go
 * gray. Compound API: Accordion > Accordion.Item > Accordion.Trigger +
 * Accordion.Content.
 */
const AccordionRoot = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>) => (
    <AccordionPrimitive.Root className={twMerge('flex flex-col gap-2', className)} {...props} />
)

const AccordionItem = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) => (
    <AccordionPrimitive.Item
        className={twMerge(
            'rounded-sm border-b border-border-default bg-background-default transition-colors duration-instant hover:bg-background-disabled data-[disabled]:border-border-subtle data-[disabled]:bg-background-disabled data-[disabled]:hover:bg-background-disabled',
            className
        )}
        {...props}
    />
)

const AccordionTrigger = ({
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) => (
    <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
            // text-body-s sits outside twMerge: stock tailwind-merge misreads it as a
            // text-color class and strips it against text-foreground-primary
            className={
                'text-body-s ' +
                twMerge(
                    'group flex w-full items-center justify-between gap-2 p-4 text-left text-foreground-primary focus-visible:outline-2 focus-visible:outline-action-focus data-[disabled]:text-foreground-secondary',
                    className
                )
            }
            {...props}
        >
            {children}
            <Icon
                name="chevron-down"
                size={20}
                className="shrink-0 transition-transform duration-moderate group-data-[state=open]:rotate-180"
            />
        </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
)

const AccordionContent = ({
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) => (
    <AccordionPrimitive.Content
        className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
        {...props}
    >
        {/* text-body-s outside twMerge — see the trigger note */}
        <div
            className={
                'text-body-s ' + twMerge('border-t border-border-default p-4 text-foreground-primary', className)
            }
        >
            {children}
        </div>
    </AccordionPrimitive.Content>
)

export const Accordion = Object.assign(AccordionRoot, {
    Item: AccordionItem,
    Trigger: AccordionTrigger,
    Content: AccordionContent,
})
