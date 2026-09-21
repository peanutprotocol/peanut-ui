'use client'

import NavHeader from '@/components/Global/NavHeader'
import { DocNavDrawer } from './_components/DocNavDrawer'
import { DocSidebar } from './_components/DocSidebar'

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return (
        // This layout owns its own scroll box. The AppShell wraps every page in
        // #scrollable-content (overflow-y:auto) but that box never scrolls —
        // the shell is min-h-dvh, so it just grows and the WINDOW scrolls.
        // A sticky child therefore picks #scrollable-content as its scrollport
        // and never engages, on phones and on desktop alike. So this layout
        // caps itself at the viewport and gives the content its own scroll
        // instead of using sticky. The cap drops --safe-top because the shell
        // already pads by it, so a plain 100dvh would run past the fold on
        // edge-to-edge iOS/Android and drift the header out of view.
        <div className="flex h-[calc(100dvh_-_var(--spacing-safe-top))] w-full min-w-0 flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-4 pt-4">
                <NavHeader title="Design System" href="/dev" />
            </div>

            {/* Mobile nav bar — a non-scrolling row, so the Menu button stays
                reachable however long the page is */}
            <div className="shrink-0 border-b border-border-disabled bg-background-default px-4 py-2 md:hidden">
                <div className="flex items-center justify-end">
                    <DocNavDrawer />
                </div>
            </div>

            {/* Content area */}
            <div className="flex min-h-0 min-w-0 flex-1 gap-6 px-4 py-8 md:px-6 lg:px-10">
                {/* Desktop sidebar — a full-height column that scrolls on its own,
                    so a nav longer than the viewport never pushes the page. */}
                <div className="hidden shrink-0 md:block md:overflow-y-auto">
                    <DocSidebar />
                </div>

                {/* Main content — the only part of the page that scrolls */}
                <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
            </div>
        </div>
    )
}
