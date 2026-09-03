'use client'

import * as React from 'react'
import { twMerge } from '@/utils/tw'
import { Drawer as DrawerPrimitive } from 'vaul'
import { useBackHandler } from '@/hooks/useBackHandler'
import { acquireBottomNavHide } from '@/utils/bottom-nav-visibility'

type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
    /**
     * Set on a drawer opened from inside another drawer. Vaul's NestedRoot stacks
     * the two and scales the parent instead of the page; a plain Root nested in a
     * Root double-applies the background scale and fights over the scroll lock.
     */
    nested?: boolean
    /** Slide the app bottom nav out of view while this (modal) sheet is open. */
    hideBottomNav?: boolean
}

/*
 * Open state is mirrored here (controlled or not) so the wrapper can own the
 * hardware-back contract: a modal sheet consumes back and closes through the
 * same onOpenChange path vaul uses for drag/Escape/outside-click; a
 * non-dismissible one consumes it as a no-op; a modal={false} sheet never
 * intercepts.
 */
const Drawer = ({
    shouldScaleBackground = true,
    nested = false,
    hideBottomNav = false,
    open,
    defaultOpen,
    onOpenChange,
    dismissible = true,
    modal = true,
    ...props
}: DrawerProps) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : uncontrolledOpen

    const handleOpenChange = React.useCallback(
        (next: boolean) => {
            if (!isControlled) setUncontrolledOpen(next)
            onOpenChange?.(next)
        },
        [isControlled, onOpenChange]
    )

    useBackHandler(() => {
        if (dismissible) handleOpenChange(false)
        return true
    }, isOpen && modal)

    React.useEffect(() => {
        if (!hideBottomNav || !isOpen || !modal) return
        return acquireBottomNavHide()
    }, [hideBottomNav, isOpen, modal])

    const Root = nested ? DrawerPrimitive.NestedRoot : DrawerPrimitive.Root
    return (
        <Root
            shouldScaleBackground={shouldScaleBackground}
            snapToSequentialPoint
            open={isOpen}
            defaultOpen={defaultOpen}
            onOpenChange={handleOpenChange}
            dismissible={dismissible}
            modal={modal}
            {...props}
        />
    )
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
    /** Ref to the inner scroll wrapper, for callers that need to measure it. */
    scrollAreaRef?: React.Ref<HTMLDivElement>
}

const DrawerContent = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Content>, DrawerContentProps>(
    ({ className, children, accessibleTitle, scrollAreaClassName, scrollAreaRef, ...props }, ref) => (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                ref={ref}
                className={twMerge(
                    // chrome per the TX Details board (17490:115877): page background,
                    // no border, handle 32x5 sitting 8px from the top with 24px below.
                    // tx-details board 17835:84492: 16px top corners (was a hardcoded 10px)
                    'fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl bg-background-page',
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
                        ref={scrollAreaRef}
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
    <div className={twMerge('grid gap-1 p-4 text-center sm:text-left', className)} {...props} />
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
        // Heading/Card (18/700/24) as a token, not the vaul-boilerplate trio it
        // replaces. `font-semibold` and `leading-none` fill --tw-font-weight and
        // --tw-leading, which is where a type token reads ITS weight and line
        // height from — so the three callers passing `text-heading-s` got the
        // 24px size and kept this component's 600 weight and 1.0 line height.
        // A token in the same conflict group loses to the caller cleanly.
        // `tracking-tight` also went: every board style is letterSpacing 0.
        className={twMerge('text-heading-card', className)}
        {...props}
    />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description
        ref={ref}
        className={twMerge('text-body-s text-foreground-secondary', className)}
        {...props}
    />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription }
