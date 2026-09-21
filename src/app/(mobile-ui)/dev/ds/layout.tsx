'use client'

import NavHeader from '@/components/Global/NavHeader'
import { DocSidebar } from './_components/DocSidebar'

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex w-full flex-col">
            {/* Header */}
            <div className="px-4 pt-4">
                <NavHeader title="Design System" href="/dev" />
            </div>

            {/* Mobile drawer trigger */}
            <div className="sticky top-0 z-10 border-b border-border-disabled bg-background-default px-6 py-3 md:hidden">
                <div className="flex items-center justify-end">
                    <DocSidebar />
                </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 px-6 py-10 lg:px-10">
                {/* Desktop sidebar — sticky against #scrollable-content (the AppShell scroller) */}
                {/* ponytail: max-h-dvh ignores safe insets, fine for a dev tool */}
                <div className="hidden md:sticky md:top-0 md:block md:max-h-dvh md:self-start md:overflow-y-auto">
                    <DocSidebar />
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1 md:pl-10">{children}</div>
            </div>
        </div>
    )
}
