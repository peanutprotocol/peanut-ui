'use client'

import { twMerge } from 'tailwind-merge'

interface AppShellProps {
    /** app = authed chrome (scroll container + bottom nav); onboarding = setup chrome. */
    variant: 'app' | 'onboarding'
    /** Bottom nav slot (app variant). Hidden when omitted. */
    nav?: React.ReactNode
    /** Top banner slot (maintenance / feedback / onboarding ribbon). */
    banner?: React.ReactNode
    /** Overlay slot — modals, drawers, scanners. Rendered after the content. */
    modals?: React.ReactNode
    /** Route-conditional overrides for the scroll container (app variant). */
    contentClassName?: string
    /** Route-conditional overrides for the centering wrapper (app variant). */
    innerClassName?: string
    /** Bottom safe-area fill color (onboarding variant, device-dependent). */
    bottomInsetClassName?: string
    children: React.ReactNode
}

/**
 * The one layout shell (DS 13). Desktop shows the same centered mobile
 * column at max width — no sidebar, no desktop-specific chrome. Safe-area
 * insets are applied here once; pages never add their own.
 */
export const AppShell = ({
    variant,
    nav,
    banner,
    modals,
    contentClassName,
    innerClassName,
    bottomInsetClassName,
    children,
}: AppShellProps) => {
    if (variant === 'onboarding') {
        return (
            <>
                {/* Status-bar safe zone + banner ribbon. Android 15 (targetSdk 36)
                    forces edge-to-edge, so the webview draws UNDER the status bar —
                    fill the inset with the brand periwinkle (matches the onboarding
                    illustration). env() resolves to 0 on web — no-op there. */}
                <div className="bg-secondary-3 pt-[env(safe-area-inset-top)]">{banner}</div>
                {children}
                {/* Bottom safe-area fill. Mirrors the strip above so the bottom
                    matches on edge-to-edge Android; iOS fills white (the panel
                    above the home indicator is white there). */}
                <div
                    aria-hidden
                    className={twMerge(
                        'pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[env(safe-area-inset-bottom)]',
                        bottomInsetClassName
                    )}
                />
                {modals}
            </>
        )
    }

    return (
        <div className="flex min-h-[100dvh] w-full flex-col bg-background-page pt-[env(safe-area-inset-top)]">
            {banner}
            {/* Scrollable content — one centered mobile column on every viewport */}
            <div
                id="scrollable-content"
                className={twMerge('relative w-full flex-1 overflow-y-auto bg-background-page p-6', contentClassName)}
            >
                <div className={twMerge('mx-auto flex w-full max-w-md items-center justify-center', innerClassName)}>
                    {children}
                </div>
            </div>
            {nav && (
                <div className="fixed inset-x-0 bottom-0 z-10 bg-background-page pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto w-full max-w-md">{nav}</div>
                </div>
            )}
            {modals}
        </div>
    )
}
