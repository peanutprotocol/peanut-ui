'use client'

import NavHeader from '@/components/Global/NavHeader'
import { DocNavDrawer } from './_components/DocNavDrawer'
import { DocSidebar } from './_components/DocSidebar'

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex w-full min-w-0 flex-col">
            {/* Header */}
            <div className="px-4 pt-4">
                <NavHeader title="Design System" href="/dev" />
            </div>

            {/* Mobile nav bar — sticks to the top of #scrollable-content */}
            <div className="sticky top-0 z-10 border-b border-border-disabled bg-background-default px-4 py-2 md:hidden">
                <div className="flex items-center justify-end">
                    <DocNavDrawer />
                </div>
            </div>

            {/* Content area */}
            <div className="flex min-w-0 flex-1 gap-6 px-4 py-8 md:px-6 lg:px-10">
                {/* Desktop sidebar — sticky against #scrollable-content (the AppShell
                    scroller), with its own scroll so a long nav never pushes the page.
                    ponytail: the 6rem cap is eyeballed (safe-top + header + the top-4
                    offset) and ignores exact insets — fine for a dev tool. */}
                <div className="hidden shrink-0 md:sticky md:top-4 md:block md:max-h-[calc(100dvh_-_6rem)] md:self-start md:overflow-y-auto">
                    <DocSidebar />
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    )
}
