'use client'

import NavHeader from '@/components/Global/NavHeader'
import { TierNav } from './_components/TierNav'
import { DocSidebar } from './_components/DocSidebar'

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex w-full flex-col">
            {/* Header */}
            <div className="px-4 pt-4">
                <NavHeader title="Design System" href="/dev" />
            </div>

            {/* Tier tabs */}
            <div className="sticky top-0 z-10 border-b border-gray-3 bg-white px-6 py-3">
                <div className="flex items-center gap-2">
                    <TierNav />
                    <div className="ml-auto md:hidden">
                        <DocSidebar />
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 px-6 py-10 lg:px-10">
                {/* Desktop sidebar */}
                <div className="hidden md:block">
                    <DocSidebar />
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1 md:pl-10">{children}</div>
            </div>
        </div>
    )
}
