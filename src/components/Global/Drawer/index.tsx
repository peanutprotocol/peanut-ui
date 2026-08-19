'use client'

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Drawer as DrawerPrimitive } from 'vaul'

const Drawer = ({ shouldScaleBackground = true, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
    return <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} snapToSequentialPoint {...props} />
}
Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Overlay ref={ref} className={twMerge('fixed inset-0 z-50 bg-black/80', className)} {...props} />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    /** Screen-reader-only DialogTitle for drawers without a visible DrawerTitle (Radix a11y requirement). */
    accessibleTitle?: string
    /** Merged onto the inner scroll wrapper — the element that owns panning when content overflows. */
    scrollAreaClassName?: string
}

const DrawerContent = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Content>, DrawerContentProps>(
    ({ className, children, accessibleTitle, scrollAreaClassName, ...props }, ref) => (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                ref={ref}
                className={twMerge(
                    // chrome per the TX Details board (17490:115877): page background,
                    // no border, handle 32x5 sitting 8px from the top with 24px below.
                    'fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-[10px] bg-background-page',
                    className
                )}
                aria-describedby={undefined}
                {...props}
                onTouchMove={(e) => e.stopPropagation()}
            >
                {accessibleTitle && <DrawerTitle className="sr-only">{accessibleTitle}</DrawerTitle>}
                <div className="mx-auto mt-2 mb-6 h-[5px] w-8 rounded-round bg-foreground-secondary" />
                <div className="flex w-full justify-center">
                    <div
                        className={twMerge(
                            'max-h-[80vh] w-full overflow-auto pb-safe-bottom md:max-w-xl',
                            scrollAreaClassName
                        )}
                    >
                        {children}
                    </div>
                </div>
            </DrawerPrimitive.Content>
        </DrawerPortal>
    )
)
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('grid gap-1.5 p-4 text-center sm:text-left', className)} {...props} />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Title
        ref={ref}
        className={twMerge('text-lg leading-none font-semibold tracking-tight', className)}
        {...props}
    />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description ref={ref} className={twMerge('text-sm text-grey-1', className)} {...props} />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription }
